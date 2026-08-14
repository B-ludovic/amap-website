/* Arithmétique des fermetures, côté écran.
   Même règle que backend/src/utils/closurePeriod.js : les deux bornes sont
   fermées. Du 24 au 31 décembre, l'AMAP est fermée huit jours, le 24 et le 31
   compris — c'est ce que la newsletter annonce et ce que le quota décompte. */

const MS_PER_DAY = 86400000;

function startOfDay(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function countClosureDays(startDate, endDate) {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  return Math.round((end - start) / MS_PER_DAY) + 1;
}

/* État d'une fermeture par rapport à aujourd'hui : passée, en cours, à venir.
   Comparaison au jour, jamais à l'heure : une fermeture qui commence
   aujourd'hui est en cours dès le matin. */
export function closureState(closure) {
  const today = startOfDay(new Date());
  const start = startOfDay(closure.startDate);
  const end = startOfDay(closure.endDate);

  if (end < today) return 'PAST';
  if (start <= today) return 'ONGOING';
  return 'UPCOMING';
}
