// Seul fichier du backend qui parle à Moneroo (paiement Mobile Money et carte).
// Documentation : https://docs.moneroo.io
// Attention : Moneroo renvoie ses réponses dans « data » ({ message, data: { id, checkout_url, … } }).
const axios = require('axios');
const env = require('../config/env');

const client = axios.create({
  baseURL: env.monerooBaseUrl,
  timeout: 15000,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
});

// La clé secrète est lue à chaque appel (elle peut être ajoutée sans redémarrer les tests).
function authHeaders() {
  if (!env.monerooSecretKey) {
    throw new Error('MONEROO_SECRET_KEY manque dans .env');
  }
  return { Authorization: `Bearer ${env.monerooSecretKey}` };
}

// Erreur Moneroo lisible dans les journaux : statut HTTP + message de Moneroo, sans la clé.
function monerooError(err, action) {
  const status = err.response?.status;
  const detail = err.response?.data?.message || err.message;
  const error = new Error(`Moneroo (${action}) a échoué${status ? ` [${status}]` : ''} : ${detail}`);
  error.cause = err;
  return error;
}

/**
 * POST /v1/payments/initialize
 * @param {object} payment { amount, currency, description, customer, return_url, metadata, methods }
 * @returns {Promise<{ id: string, checkoutUrl: string }>}
 */
async function initializePayment(payment) {
  let response;
  try {
    response = await client.post('/v1/payments/initialize', payment, { headers: authHeaders() });
  } catch (err) {
    throw monerooError(err, 'initialisation');
  }

  const data = response.data?.data;
  if (!data?.id || !data?.checkout_url) {
    throw new Error('Moneroo (initialisation) : réponse sans data.id ou data.checkout_url');
  }
  return { id: data.id, checkoutUrl: data.checkout_url };
}

/**
 * GET /v1/payments/{id}
 * @returns {Promise<object>} le paiement Moneroo (contenu de « data » : id, status, amount, metadata…)
 */
async function getPayment(id) {
  let response;
  try {
    response = await client.get(`/v1/payments/${encodeURIComponent(id)}`, { headers: authHeaders() });
  } catch (err) {
    throw monerooError(err, 'lecture');
  }

  const data = response.data?.data;
  if (!data?.id) throw new Error('Moneroo (lecture) : réponse sans data.id');
  return data;
}

/**
 * GET /v1/payments/{id}/verify — à utiliser avant de vendre un ticket (statut fiable).
 * @returns {Promise<object>} contenu de « data » : status (success, pending, failed…), amount,
 *   currency (objet { code } ou chaîne selon la réponse), metadata, capture…
 */
async function verifyPayment(id) {
  let response;
  try {
    response = await client.get(`/v1/payments/${encodeURIComponent(id)}/verify`, { headers: authHeaders() });
  } catch (err) {
    throw monerooError(err, 'vérification');
  }

  const data = response.data?.data;
  if (!data?.id) throw new Error('Moneroo (vérification) : réponse sans data.id');
  return data;
}

module.exports = { initializePayment, getPayment, verifyPayment };
