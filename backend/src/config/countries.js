// Moyens de paiement Moneroo proposés selon le pays de la zone (code ISO à 2 lettres).
// Un pays absent de cette liste ne peut pas encore vendre de tickets en ligne.
// Codes Moneroo : https://docs.moneroo.io (liste des méthodes de paiement).
// Chaque méthode doit être activée dans Moneroo > Paiements > Méthodes : une seule méthode
// non activée suffit pour que Moneroo refuse le paiement (erreur 400).
const COUNTRIES = {
  CI: {
    name: 'Côte d’Ivoire',
    // Ajouter 'card_xof' (carte bancaire) une fois la méthode activée dans Moneroo.
    methods: ['wave_ci', 'orange_ci', 'mtn_ci', 'moov_ci'],
  },
};

// Renvoie la liste des méthodes du pays, ou null s'il n'est pas configuré.
function paymentMethodsFor(countryCode) {
  return COUNTRIES[countryCode]?.methods || null;
}

module.exports = { COUNTRIES, paymentMethodsFor };
