// Durée de conservation des pièces d'identité : un an après la fermeture du compte, les photos de la CNI
// et le selfie sont supprimés du stockage, et le numéro de CNI effacé du dossier. L'historique financier
// (ventes, retraits, registre) est conservé : la loi impose de garder la comptabilité.
// Lancé chaque jour par le serveur (server.js), et à la main par scripts/purge-kyc.js.
const supabase = require('../config/supabase');
const { KYC_RETENTION_DAYS } = require('../config/legal');

const DAY_MS = 24 * 3600 * 1000;

/** @returns {Promise<{ purged: number }>} nombre de dossiers dont les pièces ont été supprimées */
async function purgeClosedVendorDocuments({ days = KYC_RETENTION_DAYS } = {}) {
  const { data: rows, error } = await supabase.rpc('vendor_kyc_to_purge', { p_days: days });
  if (error) throw error;

  let purged = 0;
  for (const row of rows || []) {
    // Les fichiers d'abord : si le stockage échoue, le dossier reste à traiter et on réessaiera demain.
    const paths = [row.id_front_path, row.id_back_path, row.selfie_path].filter(Boolean);
    const { error: storageError } = paths.length ? await supabase.storage.from('kyc-documents').remove(paths) : { error: null };
    if (storageError) {
      console.error(`Pièces du promoteur ${row.user_id} non supprimées :`, storageError.message);
      continue;
    }
    const { error: updateError } = await supabase
      .from('vendor_profiles')
      .update({ id_front_path: null, id_back_path: null, selfie_path: null, id_number: null, documents_purged_at: new Date().toISOString() })
      .eq('user_id', row.user_id);
    if (updateError) {
      console.error(`Dossier du promoteur ${row.user_id} non mis à jour :`, updateError.message);
      continue;
    }
    purged += 1;
  }
  if (purged) console.log(`Pièces d'identité supprimées pour ${purged} compte(s) fermé(s) depuis plus de ${days} jours.`);
  return { purged };
}

// Lance la suppression au démarrage (après une minute), puis toutes les 24 heures.
function scheduleKycPurge() {
  const run = () => purgeClosedVendorDocuments().catch((err) => console.error('Suppression des pièces d’identité impossible :', err.message));
  setTimeout(run, 60 * 1000).unref();
  setInterval(run, DAY_MS).unref();
}

module.exports = { purgeClosedVendorDocuments, scheduleKycPurge };
