// Supprime tout de suite les pièces d'identité des comptes fermés depuis plus d'un an.
// Le serveur le fait déjà chaque jour : ce script sert à vérifier ou à rattraper à la main.
//
// Usage (depuis backend/) : node scripts/purge-kyc.js
const { purgeClosedVendorDocuments } = require('../src/services/kycRetention');

purgeClosedVendorDocuments()
  .then(({ purged }) => {
    console.log(purged ? `${purged} dossier(s) traité(s).` : 'Aucune pièce à supprimer.');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
