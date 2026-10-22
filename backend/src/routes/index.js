// Regroupe toutes les routes sous /api.
const { Router } = require('express');
const healthRoutes = require('./health.routes');
const zonesRoutes = require('./zones.routes');
const pricingsRoutes = require('./pricings.routes');
const authRoutes = require('./auth.routes');

const router = Router();

router.use('/health', healthRoutes);
router.use('/zones', zonesRoutes);
router.use('/pricings', pricingsRoutes);
router.use('/auth', authRoutes);

module.exports = router;
