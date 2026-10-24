// Affiche un numéro par paires de chiffres : « 0707070707 » → « 07 07 07 07 07 »,
// « +2250707070707 » → « +225 07 07 07 07 07 ». Le numéro enregistré ne change pas.
// Les indicatifs d'Afrique de l'Ouest font 3 chiffres (225, 221, 223, 226, 229…).
export function formatPhone(phone) {
  if (!phone) return '';
  const pairs = (digits) => digits.replace(/(\d{2})(?=\d)/g, '$1 ');
  if (phone.startsWith('+')) return `+${phone.slice(1, 4)} ${pairs(phone.slice(4))}`;
  return pairs(phone);
}
