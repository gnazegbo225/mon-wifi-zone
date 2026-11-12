// Accès au registre financier (migration 007). Toute la logique d'argent vit dans Postgres
// (verrous, commission, transitions) ; ce fichier appelle les fonctions (voir rpc.js pour les erreurs).
const { callRpc } = require('./rpc');

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

module.exports = { getBalance, requestWithdrawal, setWithdrawalStatus, addAdjustment };
