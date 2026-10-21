const { Router } = require('express');

const router = Router();

// GET /api/health : vérifie que le serveur répond.
router.get('/', (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
