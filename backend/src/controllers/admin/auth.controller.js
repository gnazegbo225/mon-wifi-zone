// Connexion de l'espace super admin, en deux étapes (mot de passe, puis code à 6 chiffres) : voir services/mfaAuth.js.
// Le compte n'est créé que par le script scripts/create-super-admin.js, jamais par une inscription.
const { createMfaAuth } = require('../../services/mfaAuth');

module.exports = createMfaAuth({ space: 'admin', role: 'super_admin', loginAction: 'admin.login', label: 'L’espace d’administration' });
