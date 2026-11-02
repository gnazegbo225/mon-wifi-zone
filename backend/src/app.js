// Construit l'application Express (sans la démarrer).
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env');
const routes = require('./routes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Le serveur tourne derrière le proxy de l'hébergeur (Render) : on lui fait confiance pour un saut,
// afin que req.ip soit l'adresse du client (utile pour limiter les routes publiques par IP).
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: env.corsOrigin }));
// Le corps brut est gardé : la signature du webhook Moneroo se calcule sur les octets reçus.
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
