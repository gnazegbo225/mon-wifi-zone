// Relecture d'un paiement chez Moneroo, inscrite au journal des relectures (payment_sync_events, migration 012).
// Sert à l'espace développeur : derniers webhooks, problèmes, historique d'un paiement.
const supabase = require('../config/supabase');
const { syncWithMoneroo } = require('./paymentSync');

const MAX_ERROR = 500;

async function findPaymentId(providerPaymentId) {
  const { data } = await supabase.from('payments').select('id, status').eq('provider_payment_id', providerPaymentId).maybeSingle();
  return data || null;
}

// Inscrit une relecture. Ne fait jamais échouer l'appelant : le journal est un outil de diagnostic.
async function recordSync(row) {
  try {
    const { error } = await supabase.from('payment_sync_events').insert(row);
    if (error) console.error('Relecture non inscrite au journal :', error.message);
  } catch (err) {
    console.error('Relecture non inscrite au journal :', err.message);
  }
}

/**
 * Relit le paiement Moneroo et inscrit le résultat.
 * @param {string} monerooId identifiant Moneroo du paiement
 * @param {{ source: 'webhook'|'return_page'|'developer', event?: string, actorId?: string, onlyChanges?: boolean }} options
 *   onlyChanges : n'inscrit que les relectures utiles (la page /merci relit toutes les 4 secondes).
 * @returns le résultat de syncWithMoneroo ; relance l'erreur après l'avoir inscrite.
 */
async function syncAndLog(monerooId, { source, event = null, actorId = null, onlyChanges = false }) {
  const started = Date.now();
  const base = { source, event, provider_payment_id: monerooId, actor_id: actorId };
  let result;
  try {
    result = await syncWithMoneroo(monerooId);
  } catch (err) {
    const local = await findPaymentId(monerooId).catch(() => null);
    await recordSync({
      ...base,
      payment_id: local?.id || null,
      outcome: 'error',
      status_before: local?.status || null,
      status_after: local?.status || null,
      error: String(err.message || err).slice(0, MAX_ERROR),
      duration_ms: Date.now() - started,
    });
    throw err;
  }

  if (!result) {
    await recordSync({ ...base, outcome: 'unknown_payment', duration_ms: Date.now() - started });
    return null;
  }
  if (onlyChanges && result.outcome === 'unchanged') return result;
  await recordSync({
    ...base,
    payment_id: result.paymentId,
    outcome: result.outcome,
    status_before: result.previousStatus,
    status_after: result.status,
    duration_ms: Date.now() - started,
  });
  return result;
}

module.exports = { syncAndLog, recordSync };
