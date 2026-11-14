// Libellés de l'espace développeur.

export { PAYMENT_STATUS, formatDateTime, since } from '../admin/adminFormat';
export { TONE_CLASS } from '../utils/labels';

// D'où vient une relecture du paiement chez Moneroo.
export const SOURCE_LABEL = {
  webhook: 'Webhook',
  return_page: 'Page de retour',
  developer: 'Développeur',
};

// Résultat d'une relecture.
export const OUTCOME = {
  updated: { label: 'Statut mis à jour', tone: 'success' },
  unchanged: { label: 'Rien à changer', tone: 'muted' },
  unknown_payment: { label: 'Paiement inconnu', tone: 'error' },
  amount_mismatch: { label: 'Montant différent', tone: 'error' },
  no_ticket: { label: 'Payé sans ticket', tone: 'error' },
  error: { label: 'Erreur', tone: 'error' },
};

export const MONEROO_CHECK = {
  ok: 'Moneroo répond et accepte la clé.',
  no_key: 'MONEROO_SECRET_KEY manque sur le serveur.',
  key_refused: 'Moneroo refuse la clé : vérifie MONEROO_SECRET_KEY (sandbox ou live).',
  moneroo_error: 'Moneroo répond par une erreur de son côté.',
  unreachable: 'Moneroo est injoignable depuis le serveur.',
};

// 93784 s → « 1 j 2 h »
export function duration(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d} j ${h} h`;
  if (h) return `${h} h ${m} min`;
  return `${m} min`;
}
