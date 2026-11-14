// Crée le compte super admin, avec sa double authentification. C'est la SEULE façon de créer ce compte :
// il n'existe aucune inscription super admin, et le frontend ne contient aucune adresse email.
//
// Usage (à lancer depuis backend/, le mot de passe passe par une variable d'environnement) :
//   SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... SUPER_ADMIN_NAME="..." node scripts/create-super-admin.js
// Téléphone perdu : régénère le secret de double authentification d'un super admin existant :
//   SUPER_ADMIN_EMAIL=... RESET_MFA=1 node scripts/create-super-admin.js
//
// MFA_ENCRYPTION_KEY doit être définie dans .env (la même que sur le serveur).
const { run } = require('./lib/mfaAccount');

run({ role: 'super_admin', envPrefix: 'SUPER_ADMIN', label: 'super admin', defaultName: 'Super admin', issuerSuffix: 'admin' });
