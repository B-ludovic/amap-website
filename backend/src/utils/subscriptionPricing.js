/* Grille tarifaire des contrats — source unique.

   Le prix d'un contrat n'est pas un nombre qu'on choisit, c'est un nombre qui se
   déduit : prix d'un panier × nombre de livraisons de la formule. Écrire les
   totaux à la main invite chaque copie à dériver, et c'est exactement ce qui
   s'est produit — trois totaux différents circulaient pour le même contrat, dont
   un imprimé sur le PDF signé par les deux parties. On ne garde donc en dur que
   les deux nombres qui font foi, le prix hebdomadaire et le nombre de semaines
   livrées ; tout le reste est calculé, ici et nulle part ailleurs.

   Le tarif solidaire correspond à la part de l'adhérent (20 %), les 80 %
   restants étant pris en charge par le Secours Catholique. */

export const WEEKLY_PRICE = { SMALL: 19, LARGE: 29.80 };

/* Semaines effectivement livrées, fermetures de l'AMAP déduites : on ne facture
   que les paniers distribués, d'où 49 et non 52 sur l'année. */
export const DELIVERED_WEEKS = { ANNUAL: 49, DISCOVERY: 12 };

export const SOLIDARITY_SHARE = 0.20;

const BASKET_WEIGHT = { SMALL: '2-4 kg', LARGE: '6-8 kg' };
const BASKET_LABEL = { SMALL: 'Petit Panier', LARGE: 'Grand Panier' };
const TYPE_LABEL = { ANNUAL: 'Annuel', DISCOVERY: 'Découverte' };

/* Les prix circulent en euros décimaux : on arrondit au centime à chaque sortie
   pour qu'aucune erreur de représentation flottante n'atteigne un contrat. */
const toCents = (value) => Number(value.toFixed(2));

export function computeSubscriptionPrice({ type, basketSize, pricingType = 'NORMAL' }) {
  const weekly = WEEKLY_PRICE[basketSize];
  const weeks = DELIVERED_WEEKS[type];

  if (weekly === undefined || weeks === undefined) return 0;

  const total = weekly * weeks;

  return toCents(pricingType === 'SOLIDARITY' ? total * SOLIDARITY_SHARE : total);
}

/* Grille complète, telle que le formulaire public et l'administration doivent
   l'afficher. Le serveur l'expose au lieu de laisser le navigateur recopier les
   nombres : c'est la même table qui décide de l'affichage et du contrat. */
export function getPricingGrid() {
  const grid = {};

  for (const type of Object.keys(DELIVERED_WEEKS)) {
    grid[type] = {};

    for (const basketSize of Object.keys(WEEKLY_PRICE)) {
      grid[type][basketSize] = {
        name: `${TYPE_LABEL[type]} - ${BASKET_LABEL[basketSize]}`,
        weight: BASKET_WEIGHT[basketSize],
        weeks: DELIVERED_WEEKS[type],
        weeklyPrice: WEEKLY_PRICE[basketSize],
        price: computeSubscriptionPrice({ type, basketSize }),
        priceSolidarity: computeSubscriptionPrice({ type, basketSize, pricingType: 'SOLIDARITY' }),
      };
    }
  }

  return grid;
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
