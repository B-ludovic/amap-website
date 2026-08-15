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

/* ÉCRITURE DES MONTANTS

   La façon d'écrire un prix appartient à la grille au même titre que le prix
   lui-même : c'est la même phrase que l'adhérent lit sur le formulaire puis
   relit sur le contrat qu'il signe, et deux règles d'écriture vivant chacune de
   leur côté finissent par produire deux phrases pour un seul montant.

   Écrite à la main plutôt que déléguée à Intl : Node et les navigateurs ne
   choisissent pas les mêmes caractères d'espace, si bien que le même nombre
   s'écrirait différemment selon l'endroit où il est rendu. Le formulaire public
   applique déjà cette interdiction, pour la même raison.

   Les espaces sont insécables, et posées en échappement plutôt que collées
   telles quelles : un caractère invisible dans la source est un caractère qu'on
   perd à la première copie. Elles empêchent le symbole €, comme une tranche de
   milliers, de partir seul à la ligne. */
const NBSP = '\u00A0';

const groupThousands = (value) => value.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);

/* « 19,00 », « 29,80 », « 1 460,20 » — virgule décimale, milliers séparés, et
   les centimes toujours écrits, même nuls.

   Les supprimer sur un montant rond semblait plus léger, mais faisait cohabiter
   deux écritures pour une même colonne : l'en-tête du contrat annonçait « petit
   panier / 19 € » à côté de « grand panier / 29,80 € », et le récapitulatif du
   formulaire affichait un total à « 1 460,20 € » deux lignes au-dessus de
   chèques à « 365 € ». C'est aussi la règle que le navigateur applique déjà de
   son côté pour tout le reste du site : une seule façon d'écrire un montant
   dans le projet, et non deux qui se ressemblent. */
export function formatEuro(value) {
  const [whole, cents] = Number(value).toFixed(2).split('.');

  return `${groupThousands(whole)},${cents}`;
}

export const euroAmount = (value) => `${formatEuro(value)}${NBSP}€`;

/* Énoncé d'un échelonnement : « 3 chèques de 365 € et 1 chèque de 365,20 € ».
   Les chèques de même montant sont regroupés, si bien que seul le dernier se
   détache lorsqu'il porte réellement un reliquat — quatre chèques identiques
   s'annoncent « 4 chèques de 57 € » et non « 3 puis 1 » —, et qu'un règlement en
   une fois donne simplement « 1 chèque de 292,04 € ». */
export function formatInstallments(amounts) {
  const groups = [];

  for (const amount of amounts) {
    const previous = groups[groups.length - 1];
    if (previous && previous.amount === amount) previous.count += 1;
    else groups.push({ amount, count: 1 });
  }

  return groups
    .map(({ amount, count }) => `${count} chèque${count > 1 ? 's' : ''} de ${euroAmount(amount)}`)
    .join(' et ');
}

export function computeSubscriptionPrice({ type, basketSize, pricingType = 'NORMAL' }) {
  const weekly = WEEKLY_PRICE[basketSize];
  const weeks = DELIVERED_WEEKS[type];

  if (weekly === undefined || weeks === undefined) return 0;

  const total = weekly * weeks;

  return toCents(pricingType === 'SOLIDARITY' ? total * SOLIDARITY_SHARE : total);
}

/* Les trois seules modalités de règlement. Un chèque, deux, ou quatre — il n'y
   en a pas d'autres, et cette liste est l'endroit qui le dit. */
export const PAYMENT_TYPES = ['1', '2', '4'];

/* Répartition d'un montant en chèques.

   La convention n'est pas « diviser », c'est « arrondir sauf le dernier ». Un
   adhérent debout devant son chéquier n'écrit pas 365,05 € quatre fois : il
   écrit trois chèques ronds et un dernier qui absorbe la monnaie. Les trois
   premiers sont donc arrondis à l'euro, le quatrième reçoit tout le reliquat.

   Cette règle existait déjà, mais en deux exemplaires — dans le contrat PDF et
   dans le formulaire public — qui se trouvaient d'accord par chance. Le
   générateur de lignes de paiement aurait fait un troisième exemplaire. On la
   remonte donc ici, à côté du prix dont elle dérive, sans toucher à un centime :
   les montants imprimés sur le contrat signé restent ceux d'aujourd'hui.

   Le dernier chèque est toujours calculé par soustraction et jamais par
   division : c'est ce qui garantit que la somme des chèques égale exactement le
   prix, quel que soit l'arrondi appliqué aux précédents. */
export function splitPayment(price, paymentType = '1') {
  if (paymentType === '2') {
    const half = toCents(price / 2);
    return [half, toCents(price - half)];
  }

  if (paymentType === '4') {
    const quarter = Math.round(price / 4);
    return [quarter, quarter, quarter, toCents(price - quarter * 3)];
  }

  return [toCents(price)];
}

/* Les trois ventilations possibles d'un même montant, indexées par modalité.

   Chacune porte les montants et leur énoncé. Le texte n'est pas un confort
   d'affichage : c'est la phrase exacte que le contrat imprimera, envoyée telle
   quelle au formulaire pour que l'adhérent lise à l'écran ce qu'il relira sur le
   papier. La recomposer dans le navigateur rouvrirait l'écart qu'on vient de
   fermer, cette fois sur les mots et non sur les nombres. */
const installmentsFor = (price) => Object.fromEntries(
  PAYMENT_TYPES.map((paymentType) => {
    const amounts = splitPayment(price, paymentType);
    return [paymentType, { amounts, text: formatInstallments(amounts) }];
  })
);

/* Grille complète, telle que le formulaire public et l'administration doivent
   l'afficher. Le serveur l'expose au lieu de laisser le navigateur recopier les
   nombres : c'est la même table qui décide de l'affichage et du contrat.

   La ventilation en chèques descend ici pour la même raison que le prix. Le
   formulaire public l'affichait à partir de son propre calcul, écrit dans le
   navigateur ; il tombait juste, mais rien ne le garantissait — deux règles
   d'arrondi vivant chacune de leur côté finissent toujours par diverger, et
   celle-ci est imprimée sur un contrat signé par les deux parties. */
export function getPricingGrid() {
  const grid = {};

  for (const type of Object.keys(DELIVERED_WEEKS)) {
    grid[type] = {};

    for (const basketSize of Object.keys(WEEKLY_PRICE)) {
      const price = computeSubscriptionPrice({ type, basketSize });
      const priceSolidarity = computeSubscriptionPrice({ type, basketSize, pricingType: 'SOLIDARITY' });

      grid[type][basketSize] = {
        name: `${TYPE_LABEL[type]} - ${BASKET_LABEL[basketSize]}`,
        weight: BASKET_WEIGHT[basketSize],
        weeks: DELIVERED_WEEKS[type],
        weeklyPrice: WEEKLY_PRICE[basketSize],
        price,
        priceSolidarity,
        installments: installmentsFor(price),
        installmentsSolidarity: installmentsFor(priceSolidarity),
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
