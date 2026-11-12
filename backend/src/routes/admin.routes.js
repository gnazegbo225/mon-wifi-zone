// Espace super admin : /api/admin. Indépendant de l'espace promoteur (autre secret, autre audience).
const { Router } = require('express');
const { rateLimit } = require('express-rate-limit');
const authController = require('../controllers/admin/auth.controller');
const { requireAdmin } = require('../middlewares/auth');

const router = Router();

// Connexion : 10 essais par quart d'heure et par adresse IP, en plus du blocage du compte après 5 échecs.
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Trop d’essais. Réessaie dans un quart d’heure.' },
});

router.post('/auth/login', loginLimit, authController.login);
router.post('/auth/mfa', loginLimit, authController.verifyMfa);
router.get('/auth/me', requireAdmin, authController.me);

module.exports = router;
