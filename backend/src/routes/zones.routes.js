const { Router } = require('express');
const { listZones, createZone, updateZone, setZoneStatus } = require('../controllers/zones.controller');
const { requireAuth, optionalAuth, requireRole } = require('../middlewares/auth');

const router = Router();

// Lecture publique (parcours client). Un admin connecté voit aussi les zones désactivées.
router.get('/', optionalAuth, listZones);

// Écriture : admin seulement. Pas de DELETE : on désactive au lieu de supprimer.
router.post('/', requireAuth, requireRole('admin'), createZone);
router.put('/:id', requireAuth, requireRole('admin'), updateZone);
router.patch('/:id/status', requireAuth, requireRole('admin'), setZoneStatus);

module.exports = router;
