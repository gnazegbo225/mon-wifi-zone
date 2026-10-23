const path = require('node:path');
const { Router } = require('express');
const multer = require('multer');
const { importTickets, getStock } = require('../controllers/tickets.controller');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = Router();

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 Mo : largement assez pour 20 000 tickets.

// Le fichier reste en mémoire : il est lu tout de suite, jamais écrit sur le disque.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv' || ext === '.txt') return cb(null, true);
    const err = new Error('Le fichier doit être un .csv.');
    err.code = 'NOT_CSV';
    return cb(err);
  },
}).single('file');

// Traduit les erreurs de multer (fichier trop lourd, mauvais type…) en réponses 400 claires.
function receiveCsv(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'NOT_CSV') {
      return res.status(400).json({ error: err.message, field: 'file' });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Le fichier est trop lourd (5 Mo maximum).', field: 'file' });
    }
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'Envoie un seul fichier, dans le champ « file ».', field: 'file' });
    }
    return next(err);
  });
}

router.post('/import', requireAuth, requireRole('admin'), receiveCsv, importTickets);
router.get('/stock', requireAuth, getStock);

module.exports = router;
