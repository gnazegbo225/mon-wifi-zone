// Crée un compte développeur (espace /dev : santé de l'API, webhooks Moneroo, paiements bloqués),
// avec sa double authentification. C'est la SEULE façon de créer ce compte.
//
// Usage (à lancer depuis backend/, le mot de passe passe par une variable d'environnement) :
//   DEVELOPER_EMAIL=... DEVELOPER_PASSWORD=... DEVELOPER_NAME="..." node scripts/create-developer.js
// Téléphone perdu : régénère le secret de double authentification d'un développeur existant :
//   DEVELOPER_EMAIL=... RESET_MFA=1 node scripts/create-developer.js
//
// MFA_ENCRYPTION_KEY doit être définie dans .env (la même que sur le serveur).
const { run } = require('./lib/mfaAccount');

run({ role: 'developer', envPrefix: 'DEVELOPER', label: 'développeur', defaultName: 'Développeur', issuerSuffix: 'dev' });
