// Connexion de l'espace promoteur (vendor et employee).
const { Router } = require('express');
const { rateLimit } = require('express-rate-limit');
const { login, me, register, listCountries } = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth');

const router = Router();

// 20 essais par quart d'heure et par adresse IP, en plus du blocage du compte après 5 échecs.
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Trop d’essais. Réessaie dans un quart d’heure.' },
});

// Inscription : 5 comptes par heure et par adresse IP.
const registerLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Trop d’inscriptions depuis ce réseau. Réessaie dans une heure.' },
});

router.post('/login', loginLimit, login);
router.post('/register', registerLimit, register);
router.get('/countries', listCountries);
router.get('/me', requireAuth, me);

module.exports = router;
