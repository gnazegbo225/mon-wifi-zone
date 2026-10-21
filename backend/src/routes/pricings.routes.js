const { Router } = require('express');
const { listPricings } = require('../controllers/pricings.controller');

const router = Router();

router.get('/', listPricings);

module.exports = router;
