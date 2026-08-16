import { prisma } from '../config/database.js';
import { getUtcDayBounds } from '../utils/closurePeriod.js';

/* Quelles fermes manquent à l'appel ce jour-là ?

   Les deux bornes sont fermées, comme pour les fermetures de l'AMAP : une
   absence du 12 au 19 couvre le 12 et le 19. On cherche le chevauchement entre
   la période déclarée et le jour civil demandé, pour qu'une heure traînant
   derrière une date ne change jamais le résultat. */
export async function findAbsentProducerIds(date) {
  const { start, end } = getUtcDayBounds(date);

  const absences = await prisma.producerAbsence.findMany({
    where: {
      startDate: { lte: end },
      endDate: { gte: start }
    },
    select: { producerId: true }
  });

  return [...new Set(absences.map(absence => absence.producerId))];
}

/* Une absence à l'envers passerait les contrôles de date sans rien couvrir :
   startDate > endDate ne chevauche aucun jour, et la ferme resterait au
   tirage alors que l'écran affiche une absence enregistrée. */
export function validateAbsencePeriod(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Dates invalides';
  }

  if (getUtcDayBounds(end).start < getUtcDayBounds(start).start) {
    return 'La date de fin précède la date de début';
  }

  return null;
}
