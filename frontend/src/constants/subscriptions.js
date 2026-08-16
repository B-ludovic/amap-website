/* Les formules d'abonnement, en un seul endroit : la page les affiche, le
   layout les déclare aux moteurs. Deux listes de prix finiraient par diverger,
   et un tarif faux dans les données structurées se propage aux réponses des
   moteurs bien après avoir été corrigé sur la page. */

export const SIZES = {
  SMALL: { label: 'Petit panier', name: 'Petit panier', weight: '2 à 4 kg', hint: '1 à 2 personnes', weekly: '19,00 €' },
  LARGE: { label: 'Grand panier', name: 'Grand panier', weight: '6 à 8 kg', hint: 'famille', weekly: '29,80 €' },
};

export const SUBSCRIPTIONS = [
  {
    id: 'annual-small',
    type: 'ANNUAL',
    size: 'SMALL',
    name: 'Abonnement annuel',
    duration: '49 semaines · 1 an',
    priceNormal: 931,
    priceSolidarity: 186.20,
    weeks: 49,
    features: [
      'Engagement sur 1 an (49 semaines)',
      'Distribution hebdomadaire',
      'Légumes de saison variés',
      'Possibilité de pause pour les vacances',
      'Paiement en plusieurs fois par chèque',
      'Soutien direct aux producteurs locaux',
    ],
  },
  {
    id: 'annual-large',
    type: 'ANNUAL',
    size: 'LARGE',
    name: 'Abonnement annuel',
    duration: '49 semaines · 1 an',
    priceNormal: 1460.20,
    priceSolidarity: 292.04,
    weeks: 49,
    recommended: true,
    features: [
      'Engagement sur 1 an (49 semaines)',
      'Distribution hebdomadaire',
      'Légumes de saison variés',
      'Volume pensé pour une famille',
      'Possibilité de pause pour les vacances',
      'Paiement en plusieurs fois par chèque',
    ],
  },
  {
    id: 'discovery-small',
    type: 'DISCOVERY',
    size: 'SMALL',
    name: 'Abonnement découverte',
    duration: '12 semaines · 3 mois',
    priceNormal: 228,
    priceSolidarity: 45.60,
    weeks: 12,
    comingSoon: true,
    features: [
      'Engagement sur 3 mois (12 semaines)',
      'Distribution hebdomadaire',
      "Parfait pour découvrir l'AMAP",
      'Paiement en plusieurs fois par chèque',
      'Sans engagement long terme',
    ],
  },
  {
    id: 'discovery-large',
    type: 'DISCOVERY',
    size: 'LARGE',
    name: 'Abonnement découverte',
    duration: '12 semaines · 3 mois',
    priceNormal: 357.60,
    priceSolidarity: 71.52,
    weeks: 12,
    comingSoon: true,
    features: [
      'Engagement sur 3 mois (12 semaines)',
      'Distribution hebdomadaire',
      'Volume pensé pour une famille',
      "Parfait pour découvrir l'AMAP",
      'Paiement en plusieurs fois par chèque',
    ],
  },
];

