// Espace développeur : /api/dev. Indépendant des espaces promoteur et super admin (autre audience, rôle developer).
const { Router } = require('express');
const { rateLimit } = require('express-rate-limit');
const { createMfaAuth } = require('../services/mfaAuth');
const dev = require('../controllers/dev.controller');
const { requireDeveloper } = require('../middlewares/auth');

const router = Router();
// Le compte n'est créé que par le script scripts/create-developer.js.
const auth = createMfaAuth({ space: 'dev', role: 'developer', loginAction: 'dev.login', label: 'L’espace développeur' });

// Connexion : 10 essais par quart d'heure et par adresse IP, en plus du blocage du compte après 5 échecs.
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Trop d’essais. Réessaie dans un quart d’heure.' },
});

router.post('/auth/login', loginLimit, auth.login);
router.post('/auth/mfa', loginLimit, auth.verifyMfa);
router.get('/auth/me', requireDeveloper, auth.me);
router.put('/auth/email', loginLimit, requireDeveloper, auth.updateEmail);

// Santé, configuration, Moneroo.
router.get('/overview', requireDeveloper, dev.getOverview);
router.get('/moneroo', requireDeveloper, dev.checkMoneroo);

// Paiements et relectures chez Moneroo.
router.get('/payments', requireDeveloper, dev.listPayments);
router.get('/payments/:id', requireDeveloper, dev.getPayment);
router.post('/payments/:id/sync', requireDeveloper, dev.syncPayment);
router.get('/events', requireDeveloper, dev.listEvents);

module.exports = router;
