// Espace super admin : /api/admin. Indépendant de l'espace promoteur (autre secret, autre audience).
const { Router } = require('express');
const { rateLimit } = require('express-rate-limit');
const authController = require('../controllers/admin/auth.controller');
const vendorsController = require('../controllers/admin/vendors.controller');
const withdrawalsController = require('../controllers/admin/withdrawals.controller');
const overviewController = require('../controllers/admin/overview.controller');
const platformController = require('../controllers/admin/platform.controller');
const settingsController = require('../controllers/admin/settings.controller');
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
router.put('/auth/email', loginLimit, requireAdmin, authController.updateEmail);

// Vue d'ensemble, transactions et zones de toute la plateforme.
router.get('/overview', requireAdmin, overviewController.getOverview);
router.get('/transactions', requireAdmin, platformController.listTransactions);
router.get('/zones', requireAdmin, platformController.listAllZones);

// Promoteurs et vérification de leur dossier.
router.get('/vendors', requireAdmin, vendorsController.listVendors);
router.get('/vendors/:id', requireAdmin, vendorsController.getVendor);
router.post('/vendors/:id/approve', requireAdmin, vendorsController.approveVendor);
router.post('/vendors/:id/reject', requireAdmin, vendorsController.rejectVendor);
router.post('/vendors/:id/suspend', requireAdmin, vendorsController.suspendVendor);
router.post('/vendors/:id/close', requireAdmin, vendorsController.closeVendor);
router.post('/vendors/:id/reactivate', requireAdmin, vendorsController.reactivateVendor);
router.post('/vendors/:id/adjustments', requireAdmin, vendorsController.createAdjustment);

// Paramètres de la plateforme et journal des actions.
router.get('/settings', requireAdmin, settingsController.getSettings);
router.put('/settings', requireAdmin, settingsController.updateSettings);
router.get('/audit', requireAdmin, settingsController.listAudit);

// Retraits : approuver, rejeter, marquer payé (avec la référence du transfert).
router.get('/withdrawals', requireAdmin, withdrawalsController.listWithdrawals);
router.get('/withdrawals/:id', requireAdmin, withdrawalsController.getWithdrawal);
router.post('/withdrawals/:id/approve', requireAdmin, withdrawalsController.approveWithdrawal);
router.post('/withdrawals/:id/reject', requireAdmin, withdrawalsController.rejectWithdrawal);
router.post('/withdrawals/:id/mark-paid', requireAdmin, withdrawalsController.markWithdrawalPaid);

module.exports = router;
