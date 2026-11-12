// Espace super admin : /api/admin. Indépendant de l'espace promoteur (autre secret, autre audience).
const { Router } = require('express');
const { rateLimit } = require('express-rate-limit');
const authController = require('../controllers/admin/auth.controller');
const vendorsController = require('../controllers/admin/vendors.controller');
const withdrawalsController = require('../controllers/admin/withdrawals.controller');
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

// Promoteurs et vérification de leur dossier.
router.get('/vendors', requireAdmin, vendorsController.listVendors);
router.get('/vendors/:id', requireAdmin, vendorsController.getVendor);
router.post('/vendors/:id/approve', requireAdmin, vendorsController.approveVendor);
router.post('/vendors/:id/reject', requireAdmin, vendorsController.rejectVendor);

// Retraits : approuver, rejeter, marquer payé (avec la référence du transfert).
router.get('/withdrawals', requireAdmin, withdrawalsController.listWithdrawals);
router.get('/withdrawals/:id', requireAdmin, withdrawalsController.getWithdrawal);
router.post('/withdrawals/:id/approve', requireAdmin, withdrawalsController.approveWithdrawal);
router.post('/withdrawals/:id/reject', requireAdmin, withdrawalsController.rejectWithdrawal);
router.post('/withdrawals/:id/mark-paid', requireAdmin, withdrawalsController.markWithdrawalPaid);

module.exports = router;
