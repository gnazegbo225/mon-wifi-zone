// Informations juridiques affichées dans les conditions générales. À compléter avant la mise en ligne.
// Si tu modifies le TEXTE des conditions (src/pages/TermsPage.jsx), change aussi TERMS_VERSION ici
// et dans backend/src/config/legal.js (même valeur) : chaque promoteur devra les accepter de nouveau.

export const TERMS_VERSION = '2026-11-19';
export const TERMS_DATE_LABEL = '19 novembre 2026';

export const COMPANY = {
  name: 'Lumière d’Afrique Energy',
  // À compléter : forme juridique (SARL, SAS, SARLU…), capital, numéro RCCM, siège social.
  legalForm: '[forme juridique et capital]',
  rccm: '[numéro RCCM]',
  address: '[adresse du siège], Côte d’Ivoire',
  email: 'contact@monwifizone.org',
  website: 'monwifizone.org',
};

// Règles de la plateforme à la date des conditions (le taux en vigueur est aussi affiché dans l'espace promoteur).
export const RULES = {
  commission: '8 %',
  holdHours: 24,
  minWithdrawal: '1 000 F CFA',
  payoutDelay: '3 jours ouvrés',
  kycRetention: 'un (1) an',
  accountingRetention: 'dix (10) ans',
};
