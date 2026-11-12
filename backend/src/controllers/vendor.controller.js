// Espace promoteur : son dossier de vérification (/api/vendor/profile).
// Le dossier se remplit petit à petit, puis s'envoie au super admin. Il n'est modifiable que s'il
// n'a pas encore été envoyé, ou s'il a été rejeté (le promoteur corrige, puis renvoie).
const supabase = require('../config/supabase');
const { callRpc, sendHttpError } = require('../services/rpc');
const { DOCUMENTS, uploadDocument, removeDocument } = require('../services/kycStorage');
const { detectImage } = require('../utils/images');

const PAYOUT_METHODS = ['bank_transfer', 'mtn_ci', 'wave_ci', 'orange_ci'];
const TEXT_FIELDS = ['legal_name', 'business_name', 'city', 'id_number', 'bank_name', 'account_holder', 'account_number'];
const PROFILE_COLUMNS =
  'legal_name, business_name, city, id_type, id_number, id_front_path, id_back_path, selfie_path, payout_method, payout_phone, bank_name, account_holder, account_number, submitted_at, reviewed_at, rejection_reason';

async function loadProfile(userId) {
  const { data, error } = await supabase.from('vendor_profiles').select(PROFILE_COLUMNS).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (data) return data;
  // Compte créé avant la migration 008 : on lui crée un dossier vide.
  const { data: created, error: insertError } = await supabase
    .from('vendor_profiles')
    .insert({ user_id: userId })
    .select(PROFILE_COLUMNS)
    .single();
  if (insertError) throw insertError;
  return created;
}

// Modifiable : jamais envoyé, ou rejeté.
function isEditable(status, profile) {
  return status === 'rejected' || (status === 'pending_review' && !profile.submitted_at);
}

// Ce que voit le promoteur : jamais les chemins de stockage, seulement si chaque pièce est là.
function view(status, profile) {
  const documents = Object.fromEntries(Object.entries(DOCUMENTS).map(([kind, column]) => [kind, Boolean(profile[column])]));
  const fields = Object.fromEntries(
    ['legal_name', 'business_name', 'city', 'id_type', 'id_number', 'payout_method', 'payout_phone', 'bank_name', 'account_holder', 'account_number'].map(
      (k) => [k, profile[k] ?? null],
    ),
  );
  return {
    account_status: status,
    editable: isEditable(status, profile),
    submitted_at: profile.submitted_at,
    reviewed_at: profile.reviewed_at,
    rejection_reason: status === 'rejected' ? profile.rejection_reason : null,
    profile: fields,
    documents,
  };
}

const NOT_EDITABLE = { error: 'Ton dossier est en cours de vérification. Tu ne peux plus le modifier.' };

// GET /api/vendor/profile
async function getProfile(req, res) {
  const profile = await loadProfile(req.user.id);
  res.json(view(req.user.accountStatus, profile));
}

// PUT /api/vendor/profile : enregistre ce qui est rempli (le dossier peut rester incomplet jusqu'à l'envoi).
async function updateProfile(req, res) {
  const profile = await loadProfile(req.user.id);
  if (!isEditable(req.user.accountStatus, profile)) return res.status(409).json(NOT_EDITABLE);

  const b = req.body || {};
  const update = {};
  for (const field of TEXT_FIELDS) {
    if (b[field] === undefined) continue;
    if (b[field] !== null && typeof b[field] !== 'string') return res.status(400).json({ error: 'Valeur invalide.', field });
    const value = (b[field] || '').trim();
    if (value.length > 120) return res.status(400).json({ error: 'Texte trop long (120 caractères maximum).', field });
    update[field] = value || null;
  }
  if (update.id_number !== undefined && update.id_number && !/^[A-Z0-9 -]{6,30}$/i.test(update.id_number)) {
    return res.status(400).json({ error: 'Le numéro de CNI ne semble pas valide.', field: 'id_number' });
  }

  if (b.payout_method !== undefined) {
    if (b.payout_method !== null && !PAYOUT_METHODS.includes(b.payout_method)) {
      return res.status(400).json({ error: 'Choisis un moyen de retrait : virement, MTN, Wave ou Orange Money.', field: 'payout_method' });
    }
    update.payout_method = b.payout_method;
  }
  if (b.payout_phone !== undefined) {
    const phone = String(b.payout_phone || '').replace(/[\s.\-()]/g, '');
    if (phone && !/^\+?[0-9]{8,15}$/.test(phone)) {
      return res.status(400).json({ error: 'Ce numéro n’est pas valide. Par exemple : 07 07 07 07 07.', field: 'payout_phone' });
    }
    update.payout_phone = phone || null;
  }

  // Après un rejet, toute modification oblige à renvoyer le dossier.
  if (req.user.accountStatus === 'rejected') update.submitted_at = null;

  const { data, error } = await supabase
    .from('vendor_profiles')
    .update(update)
    .eq('user_id', req.user.id)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  res.json(view(req.user.accountStatus, data));
}

// POST /api/vendor/profile/documents/:kind (multipart, champ « file ») : id_front, id_back ou selfie.
async function uploadProfileDocument(req, res) {
  const column = DOCUMENTS[req.params.kind];
  if (!column) return res.status(404).json({ error: 'Pièce inconnue.' });
  if (!req.file) return res.status(400).json({ error: 'Ajoute une photo.', field: 'file' });

  const image = detectImage(req.file.buffer);
  if (!image) return res.status(400).json({ error: 'La photo doit être un fichier JPEG, PNG ou WebP.', field: 'file' });

  const profile = await loadProfile(req.user.id);
  if (!isEditable(req.user.accountStatus, profile)) return res.status(409).json(NOT_EDITABLE);

  const path = await uploadDocument(req.user.id, req.params.kind, req.file.buffer, image);
  const update = { [column]: path };
  if (req.user.accountStatus === 'rejected') update.submitted_at = null;

  const { data, error } = await supabase
    .from('vendor_profiles')
    .update(update)
    .eq('user_id', req.user.id)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) {
    await removeDocument(path);
    throw error;
  }
  await removeDocument(profile[column]);
  res.json(view(req.user.accountStatus, data));
}

// POST /api/vendor/profile/submit : envoie le dossier complet au super admin.
async function submitProfile(req, res) {
  await loadProfile(req.user.id);
  const { httpError, data } = await callRpc('submit_vendor_profile', { p_vendor_id: req.user.id });
  if (httpError) return sendHttpError(res, httpError);
  res.json(view('pending_review', data));
}

module.exports = { getProfile, updateProfile, uploadProfileDocument, submitProfile };
