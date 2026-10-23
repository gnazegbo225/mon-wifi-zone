// Vérifie le token JWT envoyé dans l'en-tête « Authorization: Bearer <token> ».
// Si le token est valide, req.user contient { id, email, role }.
const jwt = require('jsonwebtoken');
const env = require('../config/env');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  try {
    // On impose l'algorithme pour refuser les tokens signés autrement (ex : « none »).
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expiré' : 'Token invalide';
    return res.status(401).json({ error: message });
  }
}

// Pour une route publique qui en montre plus aux utilisateurs connectés.
// Sans en-tête Authorization : on continue sans req.user.
// Avec un en-tête : il doit être valide (sinon 401, comme requireAuth).
function optionalAuth(req, res, next) {
  if (!req.headers.authorization) return next();
  return requireAuth(req, res, next);
}

// À placer après requireAuth : limite une route à certains rôles.
// Exemple : router.post('/', requireAuth, requireRole('admin'), createZone);
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    next();
  };
}

module.exports = { requireAuth, optionalAuth, requireRole };
