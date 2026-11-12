// Espace promoteur, réservé au promoteur lui-même (pas à ses employés) : /api/vendor.
const { Router } = require('express');
const multer = require('multer');
const { getProfile, updateProfile, uploadProfileDocument, submitProfile } = require('../controllers/vendor.controller');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = Router();
router.use(requireAuth, requireRole('vendor'));

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 Mo par photo

// La photo reste en mémoire : son type réel est vérifié, puis elle part dans le stockage privé.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PHOTO_SIZE, files: 1 } }).single('file');

function receivePhoto(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'La photo est trop lourde (5 Mo maximum).', field: 'file' });
    }
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'Envoie une seule photo, dans le champ « file ».', field: 'file' });
    }
    return next(err);
  });
}

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.post('/profile/documents/:kind', receivePhoto, uploadProfileDocument);
router.post('/profile/submit', submitProfile);

module.exports = router;
