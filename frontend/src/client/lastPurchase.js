// Dernier achat du client sur ce téléphone : pour pré-remplir le numéro et refaire un essai.
// Simple confort : si le stockage est bloqué, le client retape son numéro.
const KEY = 'mwz_last_purchase';

export function readLastPurchase() {
  try {
    return JSON.parse(window.localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function saveLastPurchase(purchase) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(purchase));
  } catch {
    // stockage indisponible (navigation privée…) : sans conséquence
  }
}
