/* Libellés des produits, partagés par l'écran admin et l'espace producteur.
   Saisons et formats de panier sont les deux seules entrées que consulte le
   tirage hebdomadaire. */

export const CATEGORIES = [
  { value: 'VEGETABLES', label: 'Légumes' },
  { value: 'FRUITS', label: 'Fruits' },
  { value: 'EGGS', label: 'Œufs' },
  { value: 'GROCERY', label: 'Épicerie' }
];

export const SEASONS = [
  { value: 'SPRING', label: 'Printemps' },
  { value: 'SUMMER', label: 'Été' },
  { value: 'AUTUMN', label: 'Automne' },
  { value: 'WINTER', label: 'Hiver' }
];

export const BASKET_SIZES = [
  { value: 'SMALL', label: 'Petit panier' },
  { value: 'LARGE', label: 'Grand panier' }
];

export const labelOf = (list, value) => list.find((item) => item.value === value)?.label ?? value;
