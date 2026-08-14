/* Arithmétique des fermetures AMAP.
   Une seule table de calcul, partagée par le contrôleur et par le job de
   génération des paniers : le nombre de jours affiché à l'écran, le nombre de
   jours décompté du quota et le nombre de semaines sans panier viennent tous
   d'ici, ils ne peuvent donc pas se contredire. */

// Trois semaines de fermeture collective par année civile.
export const MAX_CLOSURE_DAYS_PER_YEAR = 21;

const MS_PER_DAY = 86400000;

/* Les dates arrivent en minuit UTC (« 2026-12-24 » posté par un champ date).
   On ramène tout au jour civil UTC pour que le décompte ne dépende jamais de
   l'heure qui traîne derrière la date. */
export function getUtcDayBounds(value) {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  return {
    start: new Date(Date.UTC(year, month, day)),
    end: new Date(Date.UTC(year, month, day, 23, 59, 59, 999))
  };
}

/* Les deux bornes sont fermées : du 24 au 31 décembre, l'AMAP est fermée huit
   jours, le 24 et le 31 compris. C'est ce que la newsletter annonce aux
   adhérents, c'est donc ce que le quota décompte. */
export function countClosureDays(startDate, endDate) {
  const start = getUtcDayBounds(startDate).start;
  const end = getUtcDayBounds(endDate).start;

  return Math.round((end - start) / MS_PER_DAY) + 1;
}

/* Bornes de l'année civile d'une date, pour cerner le quota annuel. */
export function getYearBounds(value) {
  const year = new Date(value).getUTCFullYear();

  return {
    year,
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))
  };
}

/* Somme des jours consommés par une liste de fermetures. */
export function sumClosureDays(closures) {
  return closures.reduce((total, closure) => total + countClosureDays(closure.startDate, closure.endDate), 0);
}
