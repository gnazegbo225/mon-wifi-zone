// Lit le fichier .env et vérifie que toutes les variables obligatoires sont là.
// Si une variable manque, le serveur s'arrête tout de suite avec un message clair.
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'];

const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Variables manquantes dans .env : ${missing.join(', ')}`);
  process.exit(1);
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',

  // Paiement (Moneroo). Facultatif au démarrage pour ne pas bloquer le serveur :
  // seule la route de paiement refuse de fonctionner tant que ces valeurs manquent.
  monerooSecretKey: process.env.MONEROO_SECRET_KEY || '',
  // Secret du webhook (« Hash secret » dans Moneroo > Développeurs > Webhooks).
  monerooWebhookSecret: process.env.MONEROO_WEBHOOK_SECRET || '',
  monerooBaseUrl: (process.env.MONEROO_BASE_URL || 'https://api.moneroo.io').replace(/\/+$/, ''),
  paymentCurrency: (process.env.PAYMENT_CURRENCY || '').trim().toUpperCase(),
  // Tests en sandbox seulement : méthodes Moneroo imposées à la place de celles du pays
  // (ex : moneroo_payment_demo, en USD). Vide en production.
  monerooTestMethods: (process.env.MONEROO_TEST_METHODS || '').split(',').map((m) => m.trim()).filter(Boolean),
  // Adresse publique du site client (sans / final) : sert au retour après paiement.
  frontendUrl: (process.env.FRONTEND_URL || '').replace(/\/+$/, ''),
  platformName: process.env.PLATFORM_NAME || 'monwifizone',
};
