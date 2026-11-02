const { Router } = require('express');
const { rateLimit } = require('express-rate-limit');
const { getPublicZone, createPaymentIntent, getPaymentStatus } = require('../controllers/public.controller');
const { monerooWebhook } = require('../controllers/webhook.controller');

const router = Router();

// Webhook Moneroo : protégé par sa signature, et placé avant la limite par IP
// (les appels viennent tous des serveurs de Moneroo).
router.post('/payments/webhook', monerooWebhook);

// Statut d'un paiement : la page /merci l'interroge toutes les 4 secondes pendant 2 minutes.
// Limite à part, plus large : sur un hotspot, tous les clients sortent par la même adresse IP.
router.get(
  '/payments/:id',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Trop de demandes. Attends une minute, puis réessaie.' },
  }),
  getPaymentStatus,
);

// Routes sans connexion : 20 requêtes par minute et par adresse IP, pour les autres routes publiques.
// (L'IP réelle du client est lue derrière le proxy de l'hébergeur : voir « trust proxy » dans app.js.)
router.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Trop de demandes. Attends une minute, puis réessaie.' },
  }),
);

router.get('/zones/:id', getPublicZone);
router.post('/payments/intent', createPaymentIntent);

module.exports = router;
