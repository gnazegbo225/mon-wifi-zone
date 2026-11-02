// Routes publiques du parcours client (sans connexion), appelées depuis le portail captif.
const crypto = require('node:crypto');
const supabase = require('../config/supabase');
const env = require('../config/env');
const { paymentMethodsFor } = require('../config/countries');
const { initializePayment } = require('../services/moneroo');
const { syncWithMoneroo } = require('../services/paymentSync');
const { whereTicketStatus } = require('../utils/ticketStatus');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESERVATION_MINUTES = 15;

// Messages au ton de la charte : le client lit ces textes.
const MESSAGES = {
  zoneNotFound: 'Cette zone WiFi n’existe pas.',
  paymentNotFound: 'On ne trouve pas ce paiement.',
  pricingNotFound: 'Ce forfait n’existe pas dans cette zone.',
  notOnSale: 'Ce forfait n’est plus en vente. Choisis-en un autre.',
  soldOut: 'Épuisé',
  unavailable: 'Le paiement en ligne n’est pas encore disponible ici. Réessaie plus tard.',
  providerFailed: 'Le paiement n’a pas pu démarrer. Ton argent n’a pas été pris. Réessaie.',
};

// « 07 07 07 07 07 » ou « +225 07… » → chiffres seulement (avec + en option), sinon null.
function normalizePhone(value) {
  if (typeof value !== 'string') return null;
  const phone = value.replace(/[\s.\-()]/g, '');
  return /^\+?[0-9]{8,15}$/.test(phone) ? phone : null;
}

// Tickets disponibles d'un forfait : libres, ou réservés dont le délai est dépassé.
async function countAvailable(pricingId) {
  const query = supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('pricing_id', pricingId);
  const { count, error } = await whereTicketStatus(query, 'free');
  if (error) throw error;
  return count;
}

// GET /api/public/zones/:id
// La zone (si elle est active), ses forfaits actifs et, pour chacun, le nombre de tickets disponibles.
// Le téléphone du gérant est affiché au client (assistance). Jamais d'adresse de routeur,
// de profil MikroTik ni de propriétaire.
async function getPublicZone(req, res) {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) return res.status(404).json({ error: MESSAGES.zoneNotFound });

  const { data: zone, error } = await supabase
    .from('wifi_zones')
    .select('id, name, city, country, is_active, manager_phone')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!zone || !zone.is_active) return res.status(404).json({ error: MESSAGES.zoneNotFound });

  const { data: pricings, error: pricingsError } = await supabase
    .from('pricings')
    .select('id, name, amount, duration_label, speed_label')
    .eq('wifi_zone_id', zone.id)
    .eq('is_active', true)
    .order('amount', { ascending: true });
  if (pricingsError) throw pricingsError;

  const withStock = await Promise.all(pricings.map(async (p) => ({ ...p, available: await countAvailable(p.id) })));

  res.json({
    zone: { id: zone.id, name: zone.name, city: zone.city, country: zone.country, manager_phone: zone.manager_phone },
    pricings: withStock,
  });
}

// Rend un ticket réservé à nouveau libre (seulement s'il est encore réservé pour ce paiement, ou sans paiement).
async function releaseTicket(ticketId, paymentId) {
  let query = supabase
    .from('tickets')
    .update({ status: 'free', reserved_until: null, payment_id: null })
    .eq('id', ticketId)
    .eq('status', 'reserved');
  query = paymentId ? query.or(`payment_id.is.null,payment_id.eq.${paymentId}`) : query.is('payment_id', null);
  const { error } = await query;
  if (error) console.error('Libération du ticket impossible', ticketId, error);
}

async function markPaymentFailed(paymentId) {
  const { error } = await supabase.from('payments').update({ status: 'failed' }).eq('id', paymentId).eq('status', 'pending');
  if (error) console.error('Paiement non marqué « failed »', paymentId, error);
}

// Domaine du site client, pour l'adresse e-mail générique : https://www.monwifizone.org → monwifizone.org
function customerEmailDomain() {
  try {
    return new URL(env.frontendUrl).hostname.replace(/^www\./, '');
  } catch {
    return 'monwifizone.org';
  }
}

// POST /api/public/payments/intent  { zone_id, pricing_id, phone }
// 1. vérifie la zone et le forfait (actifs) ; le montant vient de la base, jamais de la requête ;
// 2. réserve un ticket pour 15 minutes (409 « Épuisé » s'il n'y en a plus, sans appeler Moneroo) ;
// 3. crée le paiement « pending » (nom et durée du forfait copiés) et le relie au ticket réservé ;
// 4. demande à Moneroo une page de paiement et renvoie son checkout_url.
// Si Moneroo échoue : le ticket est libéré et le paiement marqué « failed ».
async function createPaymentIntent(req, res) {
  const { zone_id: zoneId, pricing_id: pricingId } = req.body || {};

  if (typeof zoneId !== 'string' || !UUID_REGEX.test(zoneId)) {
    return res.status(400).json({ error: 'Zone invalide.', field: 'zone_id' });
  }
  if (typeof pricingId !== 'string' || !UUID_REGEX.test(pricingId)) {
    return res.status(400).json({ error: 'Choisis un forfait.', field: 'pricing_id' });
  }
  const phone = normalizePhone(req.body?.phone);
  if (!phone) {
    return res.status(400).json({
      error: 'Ce numéro n’est pas valide. Écris-le comme ceci : 07 07 07 07 07.',
      field: 'phone',
    });
  }

  // Le paiement en ligne doit être configuré sur le serveur.
  if (!env.monerooSecretKey || !env.paymentCurrency || !env.frontendUrl) {
    console.error('Paiement non configuré : MONEROO_SECRET_KEY, PAYMENT_CURRENCY ou FRONTEND_URL manque.');
    return res.status(503).json({ error: MESSAGES.unavailable });
  }

  // --- 1. Zone et forfait --------------------------------------------------------
  const { data: zone, error: zoneError } = await supabase
    .from('wifi_zones')
    .select('id, name, country, owner_id, is_active')
    .eq('id', zoneId)
    .maybeSingle();
  if (zoneError) throw zoneError;
  if (!zone) return res.status(404).json({ error: MESSAGES.zoneNotFound, field: 'zone_id' });
  if (!zone.is_active) return res.status(409).json({ error: MESSAGES.notOnSale, field: 'zone_id' });

  const { data: pricing, error: pricingError } = await supabase
    .from('pricings')
    .select('id, name, amount, duration_label, is_active')
    .eq('id', pricingId)
    .eq('wifi_zone_id', zone.id)
    .maybeSingle();
  if (pricingError) throw pricingError;
  if (!pricing) return res.status(404).json({ error: MESSAGES.pricingNotFound, field: 'pricing_id' });
  if (!pricing.is_active) return res.status(409).json({ error: MESSAGES.notOnSale, field: 'pricing_id' });

  const methods = env.monerooTestMethods.length > 0 ? env.monerooTestMethods : paymentMethodsFor(zone.country);
  if (!methods) {
    console.error(`Aucune méthode de paiement configurée pour le pays ${zone.country} (src/config/countries.js).`);
    return res.status(503).json({ error: MESSAGES.unavailable });
  }

  // --- 2. Réservation d'un ticket (sans repli vers un autre forfait) --------------
  const { data: ticketId, error: reserveError } = await supabase.rpc('reserve_ticket', {
    p_zone_id: zone.id,
    p_pricing_id: pricing.id,
    p_minutes: RESERVATION_MINUTES,
  });
  if (reserveError) throw reserveError;
  if (!ticketId) return res.status(409).json({ error: MESSAGES.soldOut });

  // --- 3. Paiement « pending », relié au ticket ------------------------------------
  // L'identifiant Moneroo n'existe pas encore : valeur provisoire unique, remplacée juste après.
  const paymentId = crypto.randomUUID();
  const { error: insertError } = await supabase.from('payments').insert({
    id: paymentId,
    provider_payment_id: `pending:${paymentId}`,
    wifi_zone_id: zone.id,
    owner_id: zone.owner_id,
    pricing_id: pricing.id,
    amount: pricing.amount,
    pricing_name: pricing.name,
    pricing_duration_label: pricing.duration_label,
    phone,
    payment_method: 'moneroo', // le client choisit Wave, Orange… sur la page Moneroo
    status: 'pending',
  });
  if (insertError) {
    await releaseTicket(ticketId, null);
    throw insertError;
  }

  const { data: linked, error: linkError } = await supabase
    .from('tickets')
    .update({ payment_id: paymentId })
    .eq('id', ticketId)
    .eq('status', 'reserved')
    .is('payment_id', null)
    .select('id');
  if (linkError || linked.length === 0) {
    await releaseTicket(ticketId, paymentId);
    await markPaymentFailed(paymentId);
    if (linkError) throw linkError;
    throw new Error(`Le ticket ${ticketId} n’a pas pu être relié au paiement ${paymentId}`);
  }

  // --- 4. Page de paiement Moneroo -----------------------------------------------
  let checkout;
  try {
    checkout = await initializePayment({
      amount: pricing.amount,
      currency: env.paymentCurrency,
      description: `${pricing.name} — ${pricing.duration_label} (${zone.name})`,
      customer: {
        email: `client@${customerEmailDomain()}`,
        first_name: env.platformName,
        last_name: 'Client',
      },
      return_url: `${env.frontendUrl}/merci?pid=${paymentId}`,
      metadata: { payment_id: String(paymentId), pricing_id: String(pricing.id) },
      methods,
    });
  } catch (err) {
    console.error(err.message);
    await releaseTicket(ticketId, paymentId);
    await markPaymentFailed(paymentId);
    return res.status(502).json({ error: MESSAGES.providerFailed });
  }

  // On garde l'identifiant Moneroo. Si cette écriture échoue, le paiement reste retrouvable
  // grâce aux métadonnées (payment_id) : on renvoie quand même la page de paiement au client.
  const { error: providerIdError } = await supabase
    .from('payments')
    .update({ provider_payment_id: checkout.id })
    .eq('id', paymentId);
  if (providerIdError) console.error('Identifiant Moneroo non enregistré', paymentId, checkout.id, providerIdError);

  res.status(201).json({ payment_id: paymentId, checkout_url: checkout.checkoutUrl });
}

// GET /api/public/payments/:id
// Appelée par la page /merci après le retour de Moneroo. Si le paiement est encore « pending »,
// on relit son statut chez Moneroo (au cas où le webhook n'est pas encore arrivé).
// Le ticket (identifiant et mot de passe) n'est renvoyé que pour un paiement réussi :
// seul le client connaît l'identifiant du paiement (il est dans son adresse de retour).
async function getPaymentStatus(req, res) {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) return res.status(404).json({ error: MESSAGES.paymentNotFound });

  const readPayment = async () => {
    const { data, error } = await supabase
      .from('payments')
      .select('id, status, amount, pricing_name, pricing_duration_label, wifi_zone_id, pricing_id, provider_payment_id')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  let payment = await readPayment();
  if (!payment) return res.status(404).json({ error: MESSAGES.paymentNotFound });

  if (payment.status === 'pending' && !payment.provider_payment_id.startsWith('pending:') && env.monerooSecretKey) {
    try {
      await syncWithMoneroo(payment.provider_payment_id);
      payment = await readPayment();
    } catch (err) {
      console.error(`Lecture du paiement ${id} chez Moneroo impossible :`, err.message);
    }
  }

  const [{ data: zone, error: zoneError }, { data: ticket, error: ticketError }] = await Promise.all([
    supabase.from('wifi_zones').select('name, manager_phone, router_host').eq('id', payment.wifi_zone_id).maybeSingle(),
    payment.status === 'completed'
      ? supabase.from('tickets').select('username, password').eq('payment_id', payment.id).eq('status', 'sold').maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (zoneError) throw zoneError;
  if (ticketError) throw ticketError;

  res.json({
    payment: {
      id: payment.id,
      status: payment.status,
      amount: payment.amount,
      pricing_name: payment.pricing_name,
      pricing_duration_label: payment.pricing_duration_label,
      zone_id: payment.wifi_zone_id,
      zone_name: zone?.name || null,
      manager_phone: zone?.manager_phone || null,
      pricing_id: payment.pricing_id,
    },
    ticket: ticket || null,
    // Adresse du routeur, pour le bouton « Me connecter maintenant » : seulement avec le ticket payé.
    router_host: ticket ? zone?.router_host || null : null,
  });
}

module.exports = { getPublicZone, createPaymentIntent, getPaymentStatus };
