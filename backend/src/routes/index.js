// Regroupe toutes les routes sous /api.
const { Router } = require('express');
const healthRoutes = require('./health.routes');
const zonesRoutes = require('./zones.routes');
const pricingsRoutes = require('./pricings.routes');
const authRoutes = require('./auth.routes');
const ticketsRoutes = require('./tickets.routes');
const publicRoutes = require('./public.routes');
const adminRoutes = require('./admin.routes');
const vendorRoutes = require('./vendor.routes');

const router = Router();

router.use('/health', healthRoutes);
router.use('/zones', zonesRoutes);
router.use('/pricings', pricingsRoutes);
router.use('/auth', authRoutes);
router.use('/tickets', ticketsRoutes);
router.use('/public', publicRoutes);
router.use('/admin', adminRoutes);
router.use('/vendor', vendorRoutes);

module.exports = router;
