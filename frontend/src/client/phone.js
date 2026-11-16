// Numéro du client : 10 chiffres (07 07 07 07 07), avec +225 en option. Renvoie le message d'erreur, ou null.
export function phoneError(value) {
  const digits = value.replace(/\D/g, '');
  const local = digits.startsWith('225') && digits.length > 10 ? digits.slice(3) : digits;
  if (!value.trim()) return 'Écris ton numéro de téléphone.';
  if (local.length !== 10) return 'Ce numéro n’est pas complet. Il faut 10 chiffres.';
  return null;
}
