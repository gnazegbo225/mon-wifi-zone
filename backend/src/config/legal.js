// Règles juridiques de la plateforme, en un seul endroit.

// Version des conditions générales des promoteurs. À changer (date du jour) à chaque modification
// des conditions dans le frontend (src/legal/) : chaque promoteur devra les accepter de nouveau.
const TERMS_VERSION = '2026-11-19';

// Les photos de la CNI et le selfie sont supprimés ce nombre de jours après la fermeture du compte.
const KYC_RETENTION_DAYS = 365;

// Statuts qui ferment l'accès au compte (et à ceux de ses employés).
const BLOCKED_STATUSES = ['suspended', 'closed'];

module.exports = { TERMS_VERSION, KYC_RETENTION_DAYS, BLOCKED_STATUSES };
