const { Router } = require('express');
const {
  listPricings,
  createPricing,
  updatePricing,
  setPricingStatus,
} = require('../controllers/pricings.controller');
const { requireAuth, optionalAuth, requireRole } = require('../middlewares/auth');

const router = Router();

// Lecture publique (parcours client). Dans l'espace promoteur : les forfaits de ses zones, désactivés compris.
router.get('/', optionalAuth, listPricings);

// Écriture : le promoteur seulement (pas ses employés). Pas de DELETE : on désactive au lieu de supprimer.
router.post('/', requireAuth, requireRole('vendor'), createPricing);
router.put('/:id', requireAuth, requireRole('vendor'), updatePricing);
router.patch('/:id/status', requireAuth, requireRole('vendor'), setPricingStatus);

module.exports = router;
