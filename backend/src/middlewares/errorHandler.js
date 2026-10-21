const env = require('../config/env');

// Attrape toutes les erreurs. Express 5 transmet ici les erreurs des fonctions async.
// En production, on ne renvoie jamais le détail de l'erreur au client.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);

  const status = err.status || 500;
  const message =
    env.nodeEnv === 'production' && status === 500
      ? 'Erreur interne du serveur'
      : err.message || 'Erreur interne du serveur';

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
