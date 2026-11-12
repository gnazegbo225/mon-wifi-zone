// Pièces justificatives des promoteurs (CNI recto, verso, selfie) dans le stockage privé Supabase « kyc-documents ».
// Jamais d'adresse publique : le super admin les voit par un lien signé valable quelques minutes.
const supabase = require('../config/supabase');

const BUCKET = 'kyc-documents';
const SIGNED_URL_SECONDS = 5 * 60;

// Les trois pièces du dossier, et la colonne de vendor_profiles qui garde leur chemin.
const DOCUMENTS = {
  id_front: 'id_front_path',
  id_back: 'id_back_path',
  selfie: 'selfie_path',
};

// Range la pièce sous <promoteur>/<pièce>-<date>.<ext> et renvoie son chemin.
async function uploadDocument(userId, kind, buffer, { mime, ext }) {
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: mime, upsert: false });
  if (error) throw new Error(`Stockage : envoi impossible (${error.message})`);
  return path;
}

// Supprime une ancienne pièce remplacée ; un échec n'empêche pas l'envoi de la nouvelle.
async function removeDocument(path) {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.error('Ancienne pièce non supprimée', path, error.message);
}

// Lien temporaire pour afficher une pièce au super admin, ou null si elle manque.
async function signedUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error) {
    console.error('Lien de pièce impossible', path, error.message);
    return null;
  }
  return data.signedUrl;
}

module.exports = { DOCUMENTS, uploadDocument, removeDocument, signedUrl };
