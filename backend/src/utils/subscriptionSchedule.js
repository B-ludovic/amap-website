/* Retraits restants sur un contrat.
   Base fixe de 49 paniers par an — 52 semaines moins les trois semaines de
   fermeture de l'AMAP — proratisée sur la durée réelle du contrat, dont on
   retire les retraits déjà effectués.

   Le calcul vivait dans la seule liste des abonnements. La fiche de détail
   affichait donc, pour le même contrat, une valeur obtenue autrement : une
   seule fonction, lue par les deux, évite la contradiction à l'écran. */
const PICKUPS_PER_YEAR = 49;
const MS_PER_YEAR = 365.25 * 86400000;

export function computeTotalPickups({ startDate, endDate }) {
  const durationMs = new Date(endDate) - new Date(startDate);
  return Math.round((durationMs / MS_PER_YEAR) * PICKUPS_PER_YEAR);
}

export function computeRemainingPickups({ startDate, endDate, pickupsDone = 0 }) {
  return Math.max(0, computeTotalPickups({ startDate, endDate }) - pickupsDone);
}
