// Webhook Moneroo : Moneroo prévient le backend quand un paiement change de statut.
// Documentation : https://docs.moneroo.io (Webhooks)
const crypto = require('node:crypto');
const env = require('../config/env');
const { syncWithMoneroo } = require('../services/paymentSync');

// La signature X-Moneroo-Signature est un HMAC-SHA256 (hexadécimal) du corps reçu, avec le secret du webhook.
function isSignatureValid(rawBody, signature) {
  if (!rawBody || typeof signature !== 'string') return false;
  const expected = crypto.createHmac('sha256', env.monerooWebhookSecret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature.trim().toLowerCase(), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// POST /api/public/payments/webhook
// Moneroo attend un 200 en moins de 3 secondes : on répond d'abord, puis on traite.
// Le contenu du webhook ne sert qu'à savoir QUEL paiement relire : le statut est relu chez Moneroo.
async function monerooWebhook(req, res) {
  if (!env.monerooWebhookSecret) {
    console.error('Webhook Moneroo reçu, mais MONEROO_WEBHOOK_SECRET manque dans .env.');
    return res.sendStatus(503);
  }
  if (!isSignatureValid(req.rawBody, req.get('x-moneroo-signature'))) {
    return res.sendStatus(403);
  }

  res.sendStatus(200);

  const event = req.body?.event;
  const monerooId = req.body?.data?.id;
  if (typeof event !== 'string' || !event.startsWith('payment.') || !monerooId) return;

  try {
    const result = await syncWithMoneroo(String(monerooId));
    if (result) console.log(`Webhook ${event} : paiement ${result.paymentId} → ${result.status}`);
  } catch (err) {
    // Moneroo renverra le webhook ; la page /merci relira aussi le paiement.
    console.error(`Webhook ${event} (${monerooId}) non traité :`, err.message);
  }
}

module.exports = { monerooWebhook, isSignatureValid };
