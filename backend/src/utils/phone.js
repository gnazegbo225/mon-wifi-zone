// « 0707070712 » → « 07 •• •• •• 12 » : le numéro complet d'un client n'est montré à personne.
function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return null;
  return `${digits.slice(-10, -8) || digits.slice(0, 2)} •• •• •• ${digits.slice(-2)}`;
}

module.exports = { maskPhone };
