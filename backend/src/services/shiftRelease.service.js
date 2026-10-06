import { prisma } from '../config/database.js';
import emailService from './email.service.js';

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

// La distribution du jour compte encore : un changement d'horaire le mercredi matin est le plus urgent à dire.
export function isUpcoming(date) {
  return new Date(date) >= startOfToday();
}

/* Un compte qui ferme libère ses permanences à venir : places confirmées et
   propositions en attente passent en désistement. Les lignes passées restent,
   elles disent qui a tenu quoi. Rend les places confirmées libérées. */
export async function releaseUpcomingShifts(tx, userId) {
  const lignes = await tx.shiftVolunteer.findMany({
    where: {
      userId,
      status: { in: ['CONFIRMED', 'PENDING'] },
      shift: { distributionDate: { gte: startOfToday() } }
    },
    include: {
      shift: true,
      user: { select: { firstName: true, lastName: true, email: true } }
    }
  });

  if (lignes.length > 0) {
    await tx.shiftVolunteer.updateMany({
      where: { id: { in: lignes.map((ligne) => ligne.id) } },
      data: { status: 'CANCELLED' }
    });
  }

  return lignes.filter((ligne) => ligne.status === 'CONFIRMED');
}

/* Une place confirmée qui se libère se dit aux admins qui tiennent le planning ;
   ni la personne qui part ni l'admin auteur du geste ne reçoivent l'avis. */
export async function announceWithdrawal(volunteer, { accountDeleted = false, actorId = null } = {}) {
  const [admins, confirmedCount] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'ADMIN', deletedAt: null, id: { notIn: [volunteer.userId, actorId].filter(Boolean) } },
      select: { email: true, firstName: true }
    }),
    prisma.shiftVolunteer.count({ where: { shiftId: volunteer.shiftId, status: 'CONFIRMED' } })
  ]);

  await Promise.all(admins.map((admin) => emailService.sendShiftWithdrawalNotice(
    volunteer.shift,
    admin,
    { volunteer: volunteer.user, confirmedCount, accountDeleted }
  )));
}
