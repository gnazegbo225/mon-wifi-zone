const { Router } = require('express');
const { listZones } = require('../controllers/zones.controller');

const router = Router();

router.get('/', listZones);

module.exports = router;
