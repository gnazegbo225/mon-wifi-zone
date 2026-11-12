const { Router } = require('express');
const { listZones, createZone, updateZone, setZoneStatus } = require('../controllers/zones.controller');
const { requireAuth, optionalAuth, requireRole } = require('../middlewares/auth');

const router = Router();

// Lecture publique (parcours client). Dans l'espace promoteur : les zones du promoteur, désactivées comprises.
router.get('/', optionalAuth, listZones);

// Écriture : le promoteur seulement (pas ses employés). Pas de DELETE : on désactive au lieu de supprimer.
router.post('/', requireAuth, requireRole('vendor'), createZone);
router.put('/:id', requireAuth, requireRole('vendor'), updateZone);
router.patch('/:id/status', requireAuth, requireRole('vendor'), setZoneStatus);

module.exports = router;
