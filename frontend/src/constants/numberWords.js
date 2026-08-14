/* Petits nombres écrits en toutes lettres, pour les phrases qui comptent
   quelque chose de réel — « Trois fermes », « Dix réponses ». Le décompte vient
   des données, la formulation suit : rien n'est figé dans le texte.
   Au-delà de la table, l'appelant retombe sur une tournure sans chiffre. */

const WORDS = [
  'Zéro', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit',
  'Neuf', 'Dix', 'Onze', 'Douze', 'Treize', 'Quatorze', 'Quinze', 'Seize',
];

/* Renvoie le nombre en lettres, capitale initiale, ou null s'il sort de la
   table. `feminine` n'agit que sur « un », seul mot de la liste à s'accorder. */
export function spellNumber(count, { feminine = false } = {}) {
  const word = WORDS[count];
  if (!word) return null;
  if (count === 1 && feminine) return 'Une';
  return word;
}

export function spellNumberLower(count, options) {
  const word = spellNumber(count, options);
  return word ? word.toLowerCase() : null;
}
