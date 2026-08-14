import { prisma } from '../config/database.js';
import { getUtcDayBounds } from '../utils/closurePeriod.js';

/* Formatage serveur, pour les emails et les messages d'erreur. Aucun rendu
   côté navigateur ne passe par ici : le front a ses propres tables dans
   lib/format.js, justement pour éviter les écarts d'hydratation. */
export function formatDateFR(date) {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export function describeClosure(closure) {
  return `du ${formatDateFR(closure.startDate)} au ${formatDateFR(closure.endDate)}`;
}

/* Une fermeture AMAP couvre-t-elle ce jour ? Les deux bornes sont fermées,
   comme dans la newsletter envoyée aux adhérents : on cherche le chevauchement
   entre la période de fermeture et le jour civil demandé.

   Deux appelants s'appuient dessus : le job de génération, qui refuse de tirer
   un panier pour une semaine fermée, et la création de permanence, qui refuse
   d'inscrire des bénévoles un jour sans distribution. */
export async function findClosureCovering(date) {
  const { start, end } = getUtcDayBounds(date);

  return prisma.amapClosure.findFirst({
    where: {
      startDate: { lte: end },
      endDate: { gte: start }
    }
  });
}
