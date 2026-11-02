// Met un paiement de la base à jour d'après Moneroo (appelé par le webhook, et plus tard par /merci).
// On ne croit jamais le contenu du webhook : le statut, le montant et la devise sont relus chez Moneroo.
const supabase = require('../config/supabase');
const env = require('../config/env');
const { verifyPayment } = require('./moneroo');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Le paiement de la base qui correspond au paiement Moneroo : par son identifiant Moneroo,
// ou par metadata.payment_id si l'identifiant n'a pas pu être enregistré à la création.
async function findLocalPayment(remote) {
  const { data: byProvider, error } = await supabase
    .from('payments')
    .select('id, amount, status')
    .eq('provider_payment_id', remote.id)
    .maybeSingle();
  if (error) throw error;
  if (byProvider) return byProvider;

  const localId = remote.metadata?.payment_id;
  if (typeof localId !== 'string' || !UUID_REGEX.test(localId)) return null;

  const { data: byMetadata, error: metadataError } = await supabase
    .from('payments')
    .update({ provider_payment_id: remote.id })
    .eq('id', localId)
    .eq('provider_payment_id', `pending:${localId}`)
    .select('id, amount, status')
    .maybeSingle();
  if (metadataError) throw metadataError;
  return byMetadata;
}

// Les réponses Moneroo varient : devise en chaîne ou en objet { code }, méthode dans capture ou à la racine.
function remoteCurrency(remote) {
  return String(remote.currency?.code ?? remote.currency ?? '').toUpperCase();
}

function remoteMethod(remote) {
  const method = remote.capture?.method || remote.method;
  return method?.short_code || method?.code || null;
}

async function releaseTicketOf(paymentId) {
  const { error } = await supabase
    .from('tickets')
    .update({ status: 'free', reserved_until: null, payment_id: null })
    .eq('payment_id', paymentId)
    .eq('status', 'reserved');
  if (error) console.error('Libération du ticket impossible pour le paiement', paymentId, error);
}

/**
 * Relit le paiement chez Moneroo et applique son statut :
 *   success            → paiement « completed », ticket vendu (complete_payment, migration 005) ;
 *   failed / cancelled → paiement marqué ainsi, ticket rendu libre tout de suite ;
 *   autre (pending…)   → rien.
 * @returns {Promise<{ paymentId: string, status: string, ticketId: string|null } | null>}
 */
async function syncWithMoneroo(monerooId) {
  const remote = await verifyPayment(monerooId);
  const payment = await findLocalPayment(remote);
  if (!payment) {
    console.error(`Paiement Moneroo ${remote.id} inconnu de la base.`);
    return null;
  }

  if (remote.status === 'success') {
    // Le client doit avoir payé le prix du forfait, dans la bonne devise.
    const paidAmount = Number(remote.capture?.amount ?? remote.amount);
    const currency = remoteCurrency(remote);
    if (paidAmount !== payment.amount || currency !== env.paymentCurrency) {
      console.error(
        `ALERTE paiement ${payment.id} : Moneroo indique ${paidAmount} ${currency}, attendu ${payment.amount} ${env.paymentCurrency}. Ticket non délivré.`,
      );
      return { paymentId: payment.id, status: payment.status, ticketId: null };
    }

    const { data: ticketId, error } = await supabase.rpc('complete_payment', {
      p_payment_id: payment.id,
      p_method: remoteMethod(remote),
      p_transaction_id: remote.capture?.identifier || null,
    });
    if (error) throw error;
    if (!ticketId) {
      console.error(`ALERTE paiement ${payment.id} : payé, mais plus aucun ticket pour ce forfait. Prévenir le gérant.`);
    }
    return { paymentId: payment.id, status: 'completed', ticketId: ticketId || null };
  }

  if (remote.status === 'failed' || remote.status === 'cancelled') {
    const { data: updated, error } = await supabase
      .from('payments')
      .update({ status: remote.status })
      .eq('id', payment.id)
      .eq('status', 'pending')
      .select('id');
    if (error) throw error;
    if (updated.length > 0) await releaseTicketOf(payment.id);
    return { paymentId: payment.id, status: updated.length > 0 ? remote.status : payment.status, ticketId: null };
  }

  return { paymentId: payment.id, status: payment.status, ticketId: null };
}

module.exports = { syncWithMoneroo };
