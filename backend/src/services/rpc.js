// Appel des fonctions Postgres métier et traduction de leurs erreurs (« withdrawal:… », « vendor:… »…)
// en réponses HTTP au ton de la charte. Une erreur inconnue est une vraie panne : elle est relancée.
const supabase = require('../config/supabase');

const price = (n) => `${Number(n).toLocaleString('fr-FR')} F`;

const MISSING_LABELS = {
  legal_name: 'ton nom complet',
  city: 'ta ville',
  id_number: 'le numéro de ta CNI',
  id_front: 'la photo du recto de ta CNI',
  id_back: 'la photo du verso de ta CNI',
  selfie: 'ton selfie',
  payout: 'ton compte de retrait',
};

const ERRORS = {
  // Retraits (migration 007)
  'withdrawal:not_vendor': [403, 'Seul un promoteur peut demander un retrait.'],
  'withdrawal:not_approved': [403, 'Ton compte doit être vérifié avant ton premier retrait.'],
  'withdrawal:below_minimum': [400, (min) => `Le retrait minimum est de ${price(min)}.`, 'amount'],
  'withdrawal:insufficient_balance': [400, (available) => `Tu peux retirer au plus ${price(available)}.`, 'amount'],
  'withdrawal:invalid_method': [400, 'Choisis un moyen de retrait : virement, MTN, Wave ou Orange Money.', 'method'],
  'withdrawal:invalid_destination': [400, 'Complète les coordonnées de retrait.', 'destination'],
  'withdrawal:not_found': [404, 'Retrait introuvable.'],
  'withdrawal:forbidden': [403, 'Tu ne peux pas faire cette action sur ce retrait.'],
  'withdrawal:bad_transition': [409, 'Ce retrait n’est plus à cette étape. Recharge la page.'],
  'withdrawal:reference_required': [400, 'Écris la référence du transfert.', 'transfer_reference'],
  'withdrawal:reason_required': [400, 'Écris le motif du rejet.', 'reason'],
  'adjustment:forbidden': [403, 'Accès refusé.'],
  'adjustment:not_vendor': [404, 'Promoteur introuvable.'],
  'adjustment:zero_amount': [400, 'Le montant ne peut pas être 0.', 'amount'],
  'adjustment:reason_required': [400, 'Écris le motif de la correction.', 'note'],
  // Dossier et vérification (migration 008)
  'profile:not_vendor': [403, 'Seul un promoteur a un dossier de vérification.'],
  'profile:already_approved': [409, 'Ton compte est déjà vérifié.'],
  'profile:suspended': [403, 'Ton compte est suspendu.'],
  'profile:incomplete': [
    400,
    (missing) => `Il manque encore : ${String(missing || '').split(',').filter(Boolean).map((m) => MISSING_LABELS[m] || m).join(', ')}.`,
  ],
  'vendor:not_found': [404, 'Promoteur introuvable.'],
  'vendor:forbidden': [403, 'Accès refusé.'],
  'vendor:bad_transition': [409, 'Ce compte a déjà changé de statut. Recharge la page.'],
  'vendor:not_submitted': [409, 'Ce promoteur n’a pas encore envoyé son dossier.'],
  'vendor:reason_required': [400, 'Écris le motif.', 'reason'],
  // Zones des employés (migration 011)
  'employee_zone:not_found': [404, 'Employé introuvable.'],
  'employee_zone:not_owned': [400, 'Une de ces zones n’est pas à toi.', 'zone_ids'],
  'employee_zone:not_same_vendor': [400, 'Une de ces zones n’est pas à toi.', 'zone_ids'],
  // Paramètres (migration 010)
  'setting:forbidden': [403, 'Accès refusé.'],
  'setting:unknown': [400, 'Paramètre inconnu.'],
  'setting:out_of_range': [400, (range) => {
    const [min, max] = String(range || '').split('-').map(Number);
    return `Valeur hors limites : entre ${min.toLocaleString('fr-FR')} et ${max.toLocaleString('fr-FR')}.`;
  }],
};

// Erreur métier connue → { status, error, field, missing? } ; sinon null.
function toHttpError(error) {
  const known = ERRORS[error?.message];
  if (!known) return null;
  const [status, message, field] = known;
  const http = { status, error: typeof message === 'function' ? message(error.details) : message, field: field || null };
  if (error.message === 'profile:incomplete') http.missing = String(error.details || '').split(',').filter(Boolean);
  return http;
}

// { data } si tout va bien, { httpError } pour une erreur métier ; relance une vraie panne.
async function callRpc(name, params) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) {
    const http = toHttpError(error);
    if (http) return { httpError: http };
    throw error;
  }
  return { data };
}

// Envoie une erreur métier : res.status(…).json({ error, field, missing })
function sendHttpError(res, httpError) {
  const { status, ...body } = httpError;
  return res.status(status).json(body);
}

module.exports = { callRpc, toHttpError, sendHttpError };
