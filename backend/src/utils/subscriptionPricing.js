/* Grille tarifaire des contrats.
   Elle vivait en dur dans approveAndCreateSubscription, donc invisible partout
   ailleurs : l'écran d'administration ne pouvait pas annoncer à l'avance ce
   qu'un contrat coûterait sans recopier les mêmes nombres, avec le risque
   qu'une des deux copies dérive de l'autre. Une seule table, lue par les deux.

   Le tarif solidaire correspond à la part de l'adhérent (20 %), les 80 %
   restants étant pris en charge par le Secours Catholique. */
const PRICES = {
  ANNUAL: {
    SMALL: { NORMAL: 888, SOLIDARITY: 177.60 },
    LARGE: { NORMAL: 1392, SOLIDARITY: 278.40 }
  },
  DISCOVERY: {
    SMALL: { NORMAL: 222, SOLIDARITY: 44.40 },
    LARGE: { NORMAL: 348, SOLIDARITY: 69.60 }
  }
};

export function computeSubscriptionPrice({ type, basketSize, pricingType = 'NORMAL' }) {
  return PRICES[type]?.[basketSize]?.[pricingType] ?? 0;
}

/* Durée d'engagement : un an pour l'annuel, trois mois pour la découverte. */
export function computeEndDate(type, startDate = new Date()) {
  const endDate = new Date(startDate);

  if (type === 'ANNUAL') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 3);
  }

  return endDate;
}
