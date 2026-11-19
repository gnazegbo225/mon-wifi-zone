// Point d'entrée : démarre le serveur HTTP.
const app = require('./app');
const env = require('./config/env');
const { scheduleKycPurge } = require('./services/kycRetention');

app.listen(env.port, () => {
  console.log(`Serveur démarré sur http://localhost:${env.port} (${env.nodeEnv})`);
});

// Chaque jour : suppression des pièces d'identité des comptes fermés depuis plus d'un an.
scheduleKycPurge();
