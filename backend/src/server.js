// Point d'entrée : démarre le serveur HTTP.
const app = require('./app');
const env = require('./config/env');

app.listen(env.port, () => {
  console.log(`Serveur démarré sur http://localhost:${env.port} (${env.nodeEnv})`);
});
