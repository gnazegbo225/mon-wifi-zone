// Libellés et formats partagés par les pages de l'espace super admin.

export const STATUS_LABEL = {
  pending_review: 'En attente',
  approved: 'Vérifié',
  rejected: 'Rejeté',
  suspended: 'Suspendu',
  closed: 'Fermé',
};

export { PAYOUT_LABEL, TONE_CLASS, WITHDRAWAL_STATUS } from '../utils/labels';

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

// Statut d'un paiement client.
export const PAYMENT_STATUS = {
  completed: { label: 'Réussi', tone: 'success' },
  pending: { label: 'En cours', tone: 'info' },
  failed: { label: 'Échoué', tone: 'error' },
  cancelled: { label: 'Annulé', tone: 'muted' },
};

// Dernière activité : « En ligne », « vu il y a 3 h », « jamais connecté ».
export function lastSeen(vendor) {
  if (vendor.online) return 'En ligne';
  if (!vendor.last_seen_at) return 'Jamais connecté';
  return `Vu ${since(vendor.last_seen_at)}`;
}

// Journal : libellé de chaque action, et familles pour le filtre.
export const AUDIT_LABEL = {
  'admin.login': 'Connexion',
  'account.email_change': 'Adresse de connexion changée',
  'vendor.approve': 'Promoteur approuvé',
  'vendor.reject': 'Dossier rejeté',
  'vendor.suspend': 'Promoteur suspendu',
  'vendor.reactivate': 'Promoteur réactivé',
  'vendor.close': 'Compte fermé',
  'withdrawal.approve': 'Retrait approuvé',
  'withdrawal.reject': 'Retrait rejeté',
  'withdrawal.paid': 'Retrait payé',
  'adjustment.create': 'Correction de solde',
  'setting.update': 'Paramètre modifié',
  'payment.sync': 'Paiement resynchronisé (développeur)',
  'dev.login': 'Connexion développeur',
};

export const AUDIT_FAMILIES = [
  { key: '', label: 'Tout' },
  { key: 'vendor', label: 'Promoteurs' },
  { key: 'withdrawal', label: 'Retraits' },
  { key: 'adjustment', label: 'Corrections' },
  { key: 'setting', label: 'Paramètres' },
  { key: 'admin', label: 'Connexions' },
  { key: 'payment', label: 'Paiements' },
  { key: 'dev', label: 'Développeur' },
];

const SETTING_LABEL = {
  commission_rate_bps: ['Commission', (v) => `${(Number(v) / 100).toLocaleString('fr-FR')} %`],
  min_withdrawal: ['Retrait minimum', (v) => `${Number(v).toLocaleString('fr-FR')} F`],
  hold_hours: ['Attente avant retrait', (v) => `${v} h`],
};

// Phrase courte qui décrit une ligne du journal.
export function describeAudit(entry) {
  const d = entry.details || {};
  const money = (n) => `${Number(n).toLocaleString('fr-FR')} F`;
  switch (entry.action) {
    case 'setting.update': {
      const [label, fmt] = SETTING_LABEL[d.key] || [d.key, (v) => v];
      return `${label} : ${fmt(d.old)} → ${fmt(d.new)}`;
    }
    case 'adjustment.create':
      return `${d.vendor_name} : ${d.amount > 0 ? '+' : '−'}${money(Math.abs(d.amount))} — ${d.note}`;
    case 'withdrawal.paid':
      return `${d.vendor_name} : ${money(d.amount)} · réf. ${d.transfer_reference}`;
    case 'withdrawal.approve':
      return `${d.vendor_name} : ${money(d.amount)}`;
    case 'withdrawal.reject':
      return `${d.vendor_name} : ${money(d.amount)} — ${d.reason}`;
    case 'vendor.reject':
    case 'vendor.suspend':
    case 'vendor.close':
      return `${d.vendor_name}${d.reason ? ` — ${d.reason}` : ''}`;
    case 'vendor.approve':
    case 'vendor.reactivate':
      return d.vendor_name || '';
    case 'account.email_change':
      return `${d.old} → ${d.new}`;
    case 'payment.sync': {
      const label = (s) => PAYMENT_STATUS[s]?.label || s;
      return `${money(d.amount)} : ${label(d.before)} → ${label(d.after)}`;
    }
    default:
      return '';
  }
}

// Lien vers ce que l'action concerne (fiche du promoteur, retrait), ou null.
export function auditLink(entry) {
  if (entry.target_type === 'vendor') return `/admin/promoteurs/${entry.target_id}`;
  if (entry.target_type === 'withdrawal') return `/admin/retraits/${entry.target_id}`;
  if (entry.target_type === 'setting') return '/admin/parametres';
  return null;
}
