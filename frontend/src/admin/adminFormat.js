// Libellés et formats partagés par les pages de l'espace super admin.

export const STATUS_LABEL = {
  pending_review: 'En attente',
  approved: 'Vérifié',
  rejected: 'Rejeté',
  suspended: 'Suspendu',
};

export const PAYOUT_LABEL = {
  wave_ci: 'Wave',
  orange_ci: 'Orange Money',
  mtn_ci: 'MTN MoMo',
  bank_transfer: 'Virement bancaire',
};

// Ce que le super admin vérifie avant d'approuver un dossier (mêmes clés que le backend).
export const CHECKLIST_LABEL = {
  id_readable: 'La CNI est lisible et valide, recto et verso.',
  name_matches: 'Le nom du dossier est celui de la CNI.',
  selfie_matches: 'Le selfie correspond à la photo de la CNI.',
  payout_matches: 'Le compte de retrait est au nom du promoteur.',
};

const dateTime = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function formatDateTime(value) {
  return value ? dateTime.format(new Date(value)) : '—';
}

// « il y a 3 h », pour l'attente d'un dossier.
export function since(value) {
  if (!value) return '';
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `il y a ${hours} h`;
  return `il y a ${Math.round(hours / 24)} jours`;
}
