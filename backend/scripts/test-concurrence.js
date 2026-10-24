// Test de concurrence de reserve_ticket (migration 003).
//
// Met 5 tickets en stock dans un forfait de test, lance 20 réservations EN MÊME
// TEMPS, et vérifie qu'on obtient exactement 5 tickets différents et 15 refus.
// Vérifie aussi qu'une réservation expirée redevient disponible.
//
// Usage : node scripts/test-concurrence.js
// Les données de test (zone, forfait et tickets « TEST concurrence ») sont
// supprimées à la fin, même si le test échoue. Rien d'autre n'est touché.
const supabase = require('../src/config/supabase');

const STOCK = 5;
const ATTEMPTS = 20;
const TAG = `TEST concurrence ${Date.now()}`;

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? '✓' : '✕'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures += 1;
}

async function must(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

async function main() {
  const ids = { zone: null, pricing: null };

  try {
    // --- Préparation : une zone, un forfait, 5 tickets libres ---------------
    const owner = await must(supabase.from('users').select('id').eq('role', 'admin').limit(1).single());

    const zone = await must(
      supabase
        .from('wifi_zones')
        .insert({ name: TAG, city: 'Test', country: 'CI', owner_id: owner.id })
        .select('id')
        .single(),
    );
    ids.zone = zone.id;

    const pricing = await must(
      supabase
        .from('pricings')
        .insert({ wifi_zone_id: zone.id, name: TAG, amount: 100, duration_label: '1 heure', ticket_profile: 'test-concurrence' })
        .select('id')
        .single(),
    );
    ids.pricing = pricing.id;

    await must(
      supabase.from('tickets').insert(
        Array.from({ length: STOCK }, (_, i) => ({
          wifi_zone_id: zone.id,
          pricing_id: pricing.id,
          username: `test-concurrence-${i + 1}`,
          password: `pass-${i + 1}`,
          profile: 'test-concurrence',
        })),
      ),
    );
    console.log(`Stock : ${STOCK} tickets libres. Lancement de ${ATTEMPTS} réservations en même temps…\n`);

    // --- 20 réservations simultanées -----------------------------------------
    const reserve = () =>
      supabase.rpc('reserve_ticket', { p_zone_id: zone.id, p_pricing_id: pricing.id, p_minutes: 10 });
    const results = await Promise.all(Array.from({ length: ATTEMPTS }, reserve));

    const errors = results.filter((r) => r.error);
    if (errors.length > 0 && /Could not find the function/.test(errors[0].error.message)) {
      throw new Error('La fonction reserve_ticket n’existe pas : exécute d’abord la migration 003 dans Supabase.');
    }

    const reserved = results.filter((r) => !r.error && r.data).map((r) => r.data);
    const refused = results.filter((r) => !r.error && r.data === null);

    check('aucune erreur', errors.length === 0, errors[0]?.error.message);
    check(`exactement ${STOCK} réservations réussies`, reserved.length === STOCK, `${reserved.length} obtenues`);
    check(`${STOCK} tickets tous différents`, new Set(reserved).size === STOCK, `${new Set(reserved).size} différents`);
    check(`exactement ${ATTEMPTS - STOCK} refus`, refused.length === ATTEMPTS - STOCK, `${refused.length} refus`);

    const rows = await must(supabase.from('tickets').select('id, status, reserved_until').eq('pricing_id', pricing.id));
    check(
      `en base : ${STOCK} tickets « reserved » avec une date de fin`,
      rows.filter((t) => t.status === 'reserved' && t.reserved_until).length === STOCK,
    );

    // --- Une réservation expirée compte comme libre ---------------------------
    const expired = reserved.slice(0, 2);
    await must(
      supabase
        .from('tickets')
        .update({ reserved_until: new Date(Date.now() - 60_000).toISOString() })
        .in('id', expired),
    );
    const again = await Promise.all(Array.from({ length: 4 }, reserve));
    const retaken = again.filter((r) => !r.error && r.data).map((r) => r.data);
    check(
      '2 réservations expirées sont reprises, pas plus',
      retaken.length === 2 && retaken.every((id) => expired.includes(id)),
      `${retaken.length} reprises sur 4 essais`,
    );
  } finally {
    // --- Nettoyage -------------------------------------------------------------
    if (ids.pricing) await supabase.from('tickets').delete().eq('pricing_id', ids.pricing);
    if (ids.pricing) await supabase.from('pricings').delete().eq('id', ids.pricing);
    if (ids.zone) await supabase.from('wifi_zones').delete().eq('id', ids.zone);
    console.log('\nDonnées de test supprimées.');
  }

  console.log(failures === 0 ? '\nRÉSULTAT : tout est bon.' : `\nRÉSULTAT : ${failures} vérification(s) en échec.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(`\nErreur : ${err.message}`);
  process.exitCode = 1;
});
