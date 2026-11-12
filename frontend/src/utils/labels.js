// Libellés partagés par l'espace promoteur et l'espace super admin.

export const PAYOUT_LABEL = {
  wave_ci: 'Wave',
  orange_ci: 'Orange Money',
  mtn_ci: 'MTN MoMo',
  bank_transfer: 'Virement bancaire',
};

// Statut d'un retrait, vu par le promoteur.
export const WITHDRAWAL_STATUS = {
  pending: { label: 'En attente', tone: 'info' },
  approved: { label: 'Approuvé', tone: 'info' },
  paid: { label: 'Payé', tone: 'success' },
  rejected: { label: 'Rejeté', tone: 'error' },
  cancelled: { label: 'Annulé', tone: 'muted' },
};

export const TONE_CLASS = {
  info: 'bg-brand-soft text-brand',
  success: 'bg-success-soft text-success',
  error: 'bg-danger-soft text-danger',
  muted: 'bg-page text-muted ring-1 ring-line',
};
