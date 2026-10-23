const { Router } = require('express');
const {
  listPricings,
  createPricing,
  updatePricing,
  setPricingStatus,
} = require('../controllers/pricings.controller');
const { requireAuth, optionalAuth, requireRole } = require('../middlewares/auth');

const router = Router();

// Lecture publique (parcours client). Un admin connecté voit aussi les forfaits désactivés.
router.get('/', optionalAuth, listPricings);

// Écriture : admin seulement. Pas de DELETE : on désactive au lieu de supprimer.
router.post('/', requireAuth, requireRole('admin'), createPricing);
router.put('/:id', requireAuth, requireRole('admin'), updatePricing);
router.patch('/:id/status', requireAuth, requireRole('admin'), setPricingStatus);

module.exports = router;
