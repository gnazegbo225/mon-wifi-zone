// Accès au registre financier (migration 007). Toute la logique d'argent vit dans Postgres
// (verrous, commission, transitions) ; ce fichier appelle les fonctions et traduit leurs erreurs.
const supabase = require('../config/supabase');

// Erreurs levées par les fonctions SQL (« withdrawal:… », « adjustment:… ») → réponse HTTP au ton de la charte.
const ERRORS = {
  'withdrawal:not_vendor': [403, 'Seul un promoteur peut demander un retrait.'],
  'withdrawal:not_approved': [403, 'Ton compte doit être vérifié avant ton premier retrait.'],
  'withdrawal:below_minimum': [400, (min) => `Le retrait minimum est de ${Number(min).toLocaleString('fr-FR')} F.`, 'amount'],
  'withdrawal:insufficient_balance': [400, (available) => `Tu peux retirer au plus ${Number(available).toLocaleString('fr-FR')} F.`, 'amount'],
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
};

// Erreur métier (connue) → { status, error, field } ; sinon null (vraie panne, à relancer).
function toHttpError(error) {
  const known = ERRORS[error?.message];
  if (!known) return null;
  const [status, message, field] = known;
  return { status, error: typeof message === 'function' ? message(error.details) : message, field: field || null };
}

async function callRpc(name, params) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) {
    const http = toHttpError(error);
    if (http) return { httpError: http };
    throw error;
  }
  return { data };
}

// { pending_amount, available_amount, in_withdrawal, withdrawn, gross_sales, commissions } en nombres.
async function getBalance(vendorId) {
  const { data } = await callRpc('vendor_balance', { p_vendor_id: vendorId });
  const row = (Array.isArray(data) ? data[0] : data) || {};
  return Object.fromEntries(
    ['pending_amount', 'available_amount', 'in_withdrawal', 'withdrawn', 'gross_sales', 'commissions'].map((k) => [k, Number(row[k] || 0)]),
  );
}

function requestWithdrawal(vendorId, { amount, method, phone, bankName, accountHolder, accountNumber }) {
  return callRpc('request_withdrawal', {
    p_vendor_id: vendorId,
    p_amount: amount,
    p_method: method,
    p_phone: phone ?? null,
    p_bank_name: bankName ?? null,
    p_account_holder: accountHolder ?? null,
    p_account_number: accountNumber ?? null,
  });
}

function setWithdrawalStatus(withdrawalId, status, actorId, { reference = null, note = null } = {}) {
  return callRpc('set_withdrawal_status', {
    p_withdrawal_id: withdrawalId,
    p_status: status,
    p_actor_id: actorId,
    p_reference: reference,
    p_note: note,
  });
}

function addAdjustment(vendorId, amount, actorId, note) {
  return callRpc('add_adjustment', { p_vendor_id: vendorId, p_amount: amount, p_actor_id: actorId, p_note: note });
}

module.exports = { getBalance, requestWithdrawal, setWithdrawalStatus, addAdjustment, toHttpError };
