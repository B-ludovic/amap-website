import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import emailService from '../services/email.service.js';
import {
    HttpNotFoundError,
    HttpBadRequestError,
    HttpConflictError,
    HttpForbiddenError,
    httpStatusCodes
} from '../utils/httpErrors.js';
import { findClosureCovering, describeClosure } from '../services/closure.service.js';
import { logAudit } from '../services/audit.service.js';
import { announceWithdrawal, isUpcoming } from '../services/shiftRelease.service.js';

// L'équipe : les états qu'un admin pose à la main. Une proposition n'en fait pas partie.
const VOLUNTEER_STATUSES = ['CONFIRMED', 'CANCELLED', 'ABSENT'];

/* Un adhérent voit l'équipe confirmée et sa propre ligne, jamais les propositions
   des autres : un refus est à la discrétion de l'admin et ne regarde que l'intéressé. */
const visibleCrew = (volunteers, userId) =>
  volunteers.filter((volunteer) => volunteer.status === 'CONFIRMED' || volunteer.userId === userId);

/* Toute confirmation se dit à l'intéressé, qu'elle vienne d'une proposition
   acceptée ou d'un placement direct. Rend le nombre d'envois échoués. */
async function announceConfirmed(shift, volunteers) {
  const envois = await Promise.all(
    volunteers.map((volunteer) => emailService.sendShiftConfirmation(shift, volunteer.user))
  );

  return envois.filter((envoi) => !envoi.success).length;
}

/* Ce que l'admin change dans le formulaire se dit aux personnes concernées : le
   retrait à qui n'est plus attendu, le nouveau créneau à l'équipe et aux
   propositions en attente. Ni l'auteur du geste ni un compte fermé ne reçoivent
   rien. Rend le nombre d'envois échoués. */
async function announceCrewChanges({ before, after, removed, alreadyNotified, actorId }) {
  const concerned = (volunteer) => volunteer.userId !== actorId && !volunteer.user.deletedAt;
  const envois = [];

  if (isUpcoming(before.distributionDate)) {
    removed.filter(concerned).forEach((volunteer) => {
      envois.push(emailService.sendShiftRemoval(before, volunteer.user));
    });
  }

  const moved = new Date(before.distributionDate).getTime() !== new Date(after.distributionDate).getTime()
    || before.startTime !== after.startTime
    || before.endTime !== after.endTime;

  if (moved && isUpcoming(after.distributionDate)) {
    after.volunteers
      .filter((volunteer) => ['CONFIRMED', 'PENDING'].includes(volunteer.status))
      .filter((volunteer) => !alreadyNotified.has(volunteer.userId) && concerned(volunteer))
      .forEach((volunteer) => {
        envois.push(emailService.sendShiftRescheduled(after, volunteer.user, {
          before,
          pending: volunteer.status === 'PENDING'
        }));
      });
  }

  const resultats = await Promise.all(envois);
  return resultats.filter((resultat) => !resultat.success).length;
}

/* Pas de distribution un jour de fermeture, donc pas de permanence : inscrire
   des bénévoles ce jour-là leur promettrait un rendez-vous qui n'aura pas
   lieu. Même règle que le tirage du panier hebdomadaire. */
async function refuseIfClosed(date) {
  const closure = await findClosureCovering(date);

  if (closure) {
    throw new HttpBadRequestError(
      `L'AMAP est fermée ${describeClosure(closure)} : aucune distribution n'a lieu ce jour-là.`
    );
  }
}

// RÉCUPÉRER TOUTES LES PERMANENCES
const getAllShifts = asyncHandler(async (req, res) => {
  const { upcoming, past, page = 1, limit = 20 } = req.query;
  const now = new Date();
  const isAdmin = req.user.role === 'ADMIN';
  const parsedPage = Math.max(parseInt(page) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);

  const skip = (parsedPage - 1) * parsedLimit;

  let where = {};

  if (upcoming === 'true') {
    where.distributionDate = { gte: now };
  } else if (past === 'true') {
    where.distributionDate = { lt: now };
  }

  /* Le total accompagne la page : sans lui, une liste tronquée à `limit`
     passerait pour la liste complète. */
  const [total, shifts] = await Promise.all([
    prisma.shift.count({ where }),
    prisma.shift.findMany({
      where,
      skip,
      take: parsedLimit,
      include: {
        volunteers: {
          where: { user: { deletedAt: null } },
          /* Ordre explicite : les confirmés d'abord, puis par nom. Sans lui,
             l'ordre des pastilles changeait d'un rechargement à l'autre. */
          orderBy: [{ status: 'asc' }, { user: { lastName: 'asc' } }],
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                ...(isAdmin && {
                  lastName: true,
                  email: true
                })
              }
            }
          }
        }
      },
      /* L'`id` départage les dates identiques. Deux permanences peuvent tomber
         le même jour : sans ce second critère, l'ordre entre elles est libre et
         une même permanence pourrait apparaître sur deux pages, ou sur aucune. */
      orderBy: [
        { distributionDate: upcoming === 'true' ? 'asc' : 'desc' },
        { id: 'asc' }
      ]
    })
  ]);

  const shiftsWithStatus = shifts.map(shift => {
    const confirmedCount = shift.volunteers.filter(v => v.status === 'CONFIRMED').length;

    return {
      ...shift,
      ...(!isAdmin && { notes: undefined, volunteers: visibleCrew(shift.volunteers, req.user.id) }),
      isFull: confirmedCount >= shift.volunteersNeeded,
      confirmedCount
    };
  });

  res.json({
    success: true,
    data: {
      shifts: shiftsWithStatus,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit)
      }
    }
  });
});

// RÉCUPÉRER UNE PERMANENCE
const getShiftById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isAdmin = req.user.role === 'ADMIN';

  const shift = await prisma.shift.findUnique({
    where: { id },
    include: {
      volunteers: {
        where: { user: { deletedAt: null } },
        orderBy: [{ status: 'asc' }, { user: { lastName: 'asc' } }],
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
                ...(isAdmin && {
                  lastName: true,
                  email: true,
                  phone: true
                })
            }
          }
        }
      }
    }
  });

  if (!shift) {
    throw new HttpNotFoundError('Permanence introuvable');
  }

  res.json({
    success: true,
    data: {
      ...shift,
      ...(!isAdmin && { notes: undefined, volunteers: visibleCrew(shift.volunteers, req.user.id) })
    }
  });
});

// CRÉER UNE PERMANENCE (ADMIN)
const createShift = asyncHandler(async (req, res) => {
  const { distributionDate, startTime, endTime, volunteersNeeded, notes, volunteers } = req.body;

  if (!distributionDate) {
    throw new HttpBadRequestError('Date de distribution requise');
  }

  await refuseIfClosed(new Date(distributionDate));

  const shift = await prisma.shift.create({
    data: {
      distributionDate: new Date(distributionDate),
      startTime: startTime || '18:15',
      endTime: endTime || '19:15',
      volunteersNeeded: volunteersNeeded || 2,
      notes,
      volunteers: volunteers && volunteers.length > 0 ? {
        create: volunteers.map(v => ({
          userId: v.userId,
          status: v.status || 'CONFIRMED'
        }))
      } : undefined
    },
    include: {
      volunteers: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      }
    }
  });

  await logAudit(req, 'CREATE_SHIFT', 'IMPORTANT', {
    type: 'SHIFT',
    id: shift.id,
    label: shift.distributionDate.toISOString()
  }, { volunteersCount: shift.volunteers.length });

  const notificationFailures = await announceConfirmed(
    shift,
    shift.volunteers.filter((volunteer) => volunteer.status === 'CONFIRMED')
  );

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Permanence créée avec succès',
    data: shift,
    notificationFailures
  });
});

// MODIFIER UNE PERMANENCE (ADMIN)
const updateShift = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { distributionDate, startTime, endTime, volunteersNeeded, notes, volunteers } = req.body;

  const shift = await prisma.shift.findUnique({
    where: { id },
    include: { volunteers: { select: { userId: true } } }
  });

  if (!shift) {
    throw new HttpNotFoundError('Permanence introuvable');
  }

  if (distributionDate) {
    await refuseIfClosed(new Date(distributionDate));
  }

  /* Tout l'enregistrement tient dans une seule transaction : retraits, ajouts
     et champs de la permanence. Un identifiant d'utilisateur invalide fait
     échouer l'ajout, et sans transaction les retraits déjà écrits resteraient
     acquis — des bénévoles se présenteraient le mercredi sans figurer nulle
     part. Ou tout passe, ou rien ne bouge.

     Différence plutôt que table rase, aussi : on retire ceux qui ne sont plus
     dans la liste, on ajoute les nouveaux, et on ne touche pas aux inscriptions
     qui restent. Vider puis recréer effaçait le rôle et la date d'inscription
     des bénévoles qui n'avaient pourtant pas bougé. */
  const { updatedShift, newlyConfirmed, removedConfirmed } = await prisma.$transaction(async (tx) => {
    const newlyConfirmed = new Set();
    let removedConfirmed = [];

    if (Array.isArray(volunteers)) {
      const wantedIds = new Set(volunteers.map(v => v.userId).filter(Boolean));
      const current = await tx.shiftVolunteer.findMany({
        where: { shiftId: id },
        include: { user: { select: { id: true, firstName: true, email: true, deletedAt: true } } }
      });
      const currentIds = new Set(current.map(v => v.userId));

      // Le formulaire ne porte que l'équipe : une proposition absente de sa liste n'est pas retirée.
      const removed = current.filter(v => VOLUNTEER_STATUSES.includes(v.status) && !wantedIds.has(v.userId));
      if (removed.length > 0) {
        await tx.shiftVolunteer.deleteMany({ where: { id: { in: removed.map(v => v.id) } } });
      }
      removedConfirmed = removed.filter(v => v.status === 'CONFIRMED');

      const added = volunteers.filter(v => v.userId && !currentIds.has(v.userId));
      if (added.length > 0) {
        await tx.shiftVolunteer.createMany({
          data: added.map(v => ({
            shiftId: id,
            userId: v.userId,
            role: v.role || null,
            status: v.status || 'CONFIRMED'
          }))
        });
        added
          .filter(v => (v.status || 'CONFIRMED') === 'CONFIRMED')
          .forEach(v => newlyConfirmed.add(v.userId));
      }

      // Placer quelqu'un qui s'était proposé vaut acceptation, même après un refus.
      const promoted = current.filter(v => wantedIds.has(v.userId) && !VOLUNTEER_STATUSES.includes(v.status));
      if (promoted.length > 0) {
        await tx.shiftVolunteer.updateMany({
          where: { id: { in: promoted.map(v => v.id) } },
          data: { status: 'CONFIRMED' }
        });
        promoted.forEach(v => newlyConfirmed.add(v.userId));
      }
    }

    const updatedShift = await tx.shift.update({
      where: { id },
      data: {
        ...(distributionDate && { distributionDate: new Date(distributionDate) }),
        ...(startTime && { startTime }),
        ...(endTime && { endTime }),
        ...(volunteersNeeded && { volunteersNeeded }),
        notes
      },
      include: {
        volunteers: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                deletedAt: true
              }
            }
          }
        }
      }
    });

    return { updatedShift, newlyConfirmed, removedConfirmed };
  });

  await logAudit(req, 'UPDATE_SHIFT', 'IMPORTANT', {
    type: 'SHIFT',
    id,
    label: shift.distributionDate.toISOString()
  }, {
    before: { distributionDate: shift.distributionDate, volunteerIds: shift.volunteers.map(volunteer => volunteer.userId) },
    after: { distributionDate: updatedShift.distributionDate, volunteerIds: updatedShift.volunteers.map(volunteer => volunteer.userId) }
  });

  const [confirmationFailures, changeFailures] = await Promise.all([
    announceConfirmed(
      updatedShift,
      updatedShift.volunteers.filter((volunteer) => newlyConfirmed.has(volunteer.userId) && volunteer.status === 'CONFIRMED')
    ),
    announceCrewChanges({
      before: shift,
      after: updatedShift,
      removed: removedConfirmed,
      alreadyNotified: newlyConfirmed,
      actorId: req.user.id
    })
  ]);
  const notificationFailures = confirmationFailures + changeFailures;

  res.json({
    success: true,
    message: 'Permanence modifiée avec succès',
    data: updatedShift,
    notificationFailures
  });
});

// SUPPRIMER UNE PERMANENCE (ADMIN)
const deleteShift = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const shift = await prisma.shift.findUnique({
    where: { id },
    include: {
      volunteers: {
        include: {
          user: { select: { firstName: true, email: true } }
        }
      }
    }
  });

  if (!shift) {
    throw new HttpNotFoundError('Permanence introuvable');
  }

  await prisma.shift.delete({ where: { id } });

  await logAudit(req, 'DELETE_SHIFT', 'IMPORTANT', {
    type: 'SHIFT',
    id,
    label: shift.distributionDate.toISOString()
  }, { volunteersCount: shift.volunteers.length });

  /* La suppression est faite et ne se rejoue pas : pas d'erreur HTTP si un
     message n'est pas parti. Mais le décompte remonte à l'écran, sinon deux
     bénévoles se présentent devant un local fermé. */
  const envois = await Promise.all(
    shift.volunteers
      .filter((volunteer) => volunteer.status === 'CONFIRMED')
      .map((volunteer) => emailService.sendShiftCancellation(shift, volunteer.user))
  );

  const echecs = envois.filter((envoi) => !envoi.success).length;

  if (echecs > 0) {
    console.error(`[Shifts] Permanence ${id} supprimée, ${echecs}/${envois.length} bénévole(s) non prévenu(s) — voir EmailLog`);
  }

  res.json({
    success: true,
    message: echecs === 0
      ? 'Permanence supprimée avec succès'
      : `Permanence supprimée, mais ${echecs} bénévole${echecs > 1 ? 's n\'ont' : ' n\'a'} pas pu être prévenu${echecs > 1 ? 's' : ''} par email. À contacter autrement.`,
    notified: envois.length - echecs,
    notificationFailures: echecs
  });
});

// SE PROPOSER POUR UNE PERMANENCE (ADHÉRENT)
// Une proposition n'occupe aucune place : seul un admin la confirme ou la refuse.
const proposeShift = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const shift = await prisma.shift.findUnique({ where: { id } });

  if (!shift) {
    throw new HttpNotFoundError('Permanence introuvable');
  }

  if (shift.distributionDate < new Date()) {
    throw new HttpBadRequestError('Cette permanence est passée');
  }

  await refuseIfClosed(shift.distributionDate);

  // Être adhérent, c'est avoir un contrat en cours qui couvre la date de la distribution.
  const contrat = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['ACTIVE', 'PAUSED'] },
      startDate: { lte: shift.distributionDate },
      endDate: { gte: shift.distributionDate }
    },
    select: { id: true }
  });

  if (!contrat) {
    throw new HttpForbiddenError('Les permanences sont ouvertes aux adhérents dont le contrat couvre cette date');
  }

  const existing = await prisma.shiftVolunteer.findUnique({
    where: { shiftId_userId: { shiftId: id, userId } }
  });

  if (existing?.status === 'REFUSED') {
    throw new HttpConflictError('Vous ne pouvez pas vous proposer à nouveau pour cette date');
  }

  // Un désistement n'enferme personne : la ligne annulée redevient une proposition.
  if (existing && existing.status !== 'CANCELLED') {
    throw new HttpConflictError(existing.status === 'PENDING'
      ? 'Votre proposition est déjà en attente'
      : 'Vous êtes déjà inscrit à cette permanence');
  }

  const confirmed = await prisma.shiftVolunteer.count({
    where: { shiftId: id, status: 'CONFIRMED' }
  });

  if (confirmed >= shift.volunteersNeeded) {
    throw new HttpConflictError('Cette permanence est complète');
  }

  const proposal = existing
    ? await prisma.shiftVolunteer.update({ where: { id: existing.id }, data: { status: 'PENDING' } })
    : await prisma.shiftVolunteer.create({ data: { shiftId: id, userId, status: 'PENDING' } });

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Proposition envoyée',
    data: proposal
  });
});

// SE DÉSISTER D'UNE PERMANENCE (ADHÉRENT)
const leaveShift = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  /* La permanence et l'adhérent viennent avec l'inscription : trois requêtes
     séparées laissaient la porte ouverte à une permanence supprimée entre-temps,
     dont on lisait ensuite la date. */
  const volunteer = await prisma.shiftVolunteer.findUnique({
    where: {
      shiftId_userId: {
        shiftId: id,
        userId
      }
    },
    include: {
      shift: true,
      user: { select: { firstName: true, lastName: true, email: true } }
    }
  });

  if (!volunteer) {
    throw new HttpNotFoundError('Inscription introuvable');
  }

  /* Un désistement déjà enregistré n'en est plus un : sans ce contrôle, un
     second appel réécrivait le même statut et renvoyait un deuxième email de
     désistement pour une inscription déjà annulée. */
  if (volunteer.status === 'CANCELLED') {
    throw new HttpConflictError('Vous vous êtes déjà désisté de cette permanence');
  }

  if (volunteer.status === 'REFUSED') {
    throw new HttpConflictError('Aucune proposition à retirer pour cette date');
  }

  /* Conditionnel à l'état lu : un admin a pu accepter la proposition entre-temps,
     et ce retrait ne doit pas défaire une place confirmée hors de la règle des 48 h. */
  const retirer = async () => {
    const { count } = await prisma.shiftVolunteer.updateMany({
      where: { id: volunteer.id, status: volunteer.status },
      data: { status: 'CANCELLED' }
    });

    if (count === 0) {
      throw new HttpConflictError('Votre inscription vient de changer : rechargez la page');
    }
  };

  // Une proposition n'occupe aucune place : elle se retire à tout moment.
  if (volunteer.status === 'PENDING') {
    await retirer();
    return res.json({ success: true, message: 'Proposition retirée' });
  }

  // Vérifier délai (ex: 48h avant)
  const hoursBefore = (new Date(volunteer.shift.distributionDate) - new Date()) / (1000 * 60 * 60);

  if (hoursBefore < 48) {
    throw new HttpBadRequestError('Vous ne pouvez plus vous désister moins de 48h avant');
  }

  await retirer();

  await emailService.sendShiftWithdrawal(volunteer.shift, volunteer.user);
  await announceWithdrawal(volunteer);

  res.json({
    success: true,
    message: 'Désinscription confirmée'
  });
});

/* CHANGER L'ÉTAT D'UN BÉNÉVOLE (ADMIN)
   L'ancienne route ne savait que marquer une absence, sans retour possible :
   un clic malheureux restait gravé. Elle prend maintenant l'état visé, ce qui
   rend le geste réversible. Le paramètre d'URL est bien l'identifiant de
   l'utilisateur, pas celui de la ligne d'inscription. */
const updateVolunteerStatus = asyncHandler(async (req, res) => {
  const { shiftId, userId } = req.params;
  const { status = 'ABSENT' } = req.body;

  if (!VOLUNTEER_STATUSES.includes(status)) {
    throw new HttpBadRequestError(`État invalide : ${status}`);
  }

  const volunteer = await prisma.shiftVolunteer.findUnique({
    where: {
      shiftId_userId: { shiftId, userId }
    }
  });

  if (!volunteer) {
    throw new HttpNotFoundError('Bénévole introuvable');
  }

  if (!VOLUNTEER_STATUSES.includes(volunteer.status)) {
    throw new HttpConflictError('Une proposition se traite par « Accepter » ou « Refuser »');
  }

  const updated = await prisma.shiftVolunteer.update({
    where: { id: volunteer.id },
    data: { status }
  });

  await logAudit(req, 'UPDATE_SHIFT_VOLUNTEER_STATUS', 'IMPORTANT', {
    type: 'SHIFT_VOLUNTEER',
    id: volunteer.id,
    label: shiftId
  }, { before: { status: volunteer.status }, after: { status: updated.status } });

  res.json({
    success: true,
    message: 'Statut mis à jour',
    data: updated
  });
});

// PROPOSITIONS EN ATTENTE (ADMIN)
const getPendingProposals = asyncHandler(async (req, res) => {
  const now = new Date();

  const proposals = await prisma.shiftVolunteer.findMany({
    where: {
      status: 'PENDING',
      shift: { distributionDate: { gte: now } },
      user: { deletedAt: null }
    },
    include: {
      shift: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true } }
    },
    orderBy: [{ shift: { distributionDate: 'asc' } }, { createdAt: 'asc' }]
  });

  const userIds = [...new Set(proposals.map(p => p.userId))];
  const shiftIds = [...new Set(proposals.map(p => p.shiftId))];

  // Les permanences tenues depuis janvier aident à choisir entre plusieurs volontaires.
  const [tenues, places] = await Promise.all([
    prisma.shiftVolunteer.findMany({
      where: {
        userId: { in: userIds },
        status: 'CONFIRMED',
        shift: { distributionDate: { gte: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), lt: now } }
      },
      select: { userId: true }
    }),
    prisma.shiftVolunteer.findMany({
      where: { shiftId: { in: shiftIds }, status: 'CONFIRMED' },
      select: { shiftId: true }
    })
  ]);

  const compter = (lignes, cle) => lignes.reduce((total, ligne) => total.set(ligne[cle], (total.get(ligne[cle]) ?? 0) + 1), new Map());
  const tenuesParAdherent = compter(tenues, 'userId');
  const confirmesParPermanence = compter(places, 'shiftId');

  res.json({
    success: true,
    data: proposals.map(proposal => ({
      ...proposal,
      shiftsDoneThisYear: tenuesParAdherent.get(proposal.userId) ?? 0,
      confirmedCount: confirmesParPermanence.get(proposal.shiftId) ?? 0
    }))
  });
});

// ACCEPTER UNE PROPOSITION (ADMIN)
const acceptProposal = asyncHandler(async (req, res) => {
  const { shiftId, userId } = req.params;

  /* Le verrou de ligne range les décisions concurrentes à la file : deux
     acceptations simultanées ne dépassent pas l'effectif attendu. */
  const volunteer = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Shift" WHERE id = ${shiftId} FOR UPDATE`;

    const proposal = await tx.shiftVolunteer.findUnique({
      where: { shiftId_userId: { shiftId, userId } },
      include: { shift: true }
    });

    if (!proposal || proposal.status !== 'PENDING') {
      throw new HttpConflictError('Aucune proposition en attente pour ce bénévole');
    }

    if (proposal.shift.distributionDate < new Date()) {
      throw new HttpBadRequestError('Cette permanence est passée');
    }

    await refuseIfClosed(proposal.shift.distributionDate);

    const confirmed = await tx.shiftVolunteer.count({
      where: { shiftId, status: 'CONFIRMED' }
    });

    if (confirmed >= proposal.shift.volunteersNeeded) {
      throw new HttpConflictError('La permanence est déjà complète');
    }

    return tx.shiftVolunteer.update({
      where: { id: proposal.id },
      data: { status: 'CONFIRMED' },
      include: { shift: true, user: { select: { firstName: true, email: true } } }
    });
  });

  await logAudit(req, 'UPDATE_SHIFT_VOLUNTEER_STATUS', 'IMPORTANT', {
    type: 'SHIFT_VOLUNTEER',
    id: volunteer.id,
    label: shiftId
  }, { before: { status: 'PENDING' }, after: { status: 'CONFIRMED' } });

  const envoi = await emailService.sendShiftConfirmation(volunteer.shift, volunteer.user);

  res.json({
    success: true,
    message: envoi.success
      ? 'Proposition acceptée'
      : 'Proposition acceptée, mais l\'email n\'a pas pu partir : prévenez la personne autrement.',
    notified: envoi.success,
    data: volunteer
  });
});

// REFUSER UNE PROPOSITION (ADMIN)
// Le refus est à la discrétion de l'admin : aucun motif n'est demandé ni transmis.
const refuseProposal = asyncHandler(async (req, res) => {
  const { shiftId, userId } = req.params;

  const proposal = await prisma.shiftVolunteer.findUnique({
    where: { shiftId_userId: { shiftId, userId } },
    include: { shift: true, user: { select: { firstName: true, email: true } } }
  });

  if (!proposal || proposal.status !== 'PENDING') {
    throw new HttpConflictError('Aucune proposition en attente pour ce bénévole');
  }

  // Conditionnel : une acceptation concurrente l'emporte, le refus ne l'écrase pas.
  const { count } = await prisma.shiftVolunteer.updateMany({
    where: { id: proposal.id, status: 'PENDING' },
    data: { status: 'REFUSED' }
  });

  if (count === 0) {
    throw new HttpConflictError('Cette proposition vient d\'être traitée');
  }

  await logAudit(req, 'UPDATE_SHIFT_VOLUNTEER_STATUS', 'IMPORTANT', {
    type: 'SHIFT_VOLUNTEER',
    id: proposal.id,
    label: shiftId
  }, { before: { status: 'PENDING' }, after: { status: 'REFUSED' } });

  const envoi = await emailService.sendShiftRefusal(proposal.shift, proposal.user);

  res.json({
    success: true,
    message: envoi.success
      ? 'Proposition refusée'
      : 'Proposition refusée, mais l\'email n\'a pas pu partir.',
    notified: envoi.success,
    data: { ...proposal, status: 'REFUSED' }
  });
});

// MES PERMANENCES (ADHÉRENT)
const getMyShifts = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { upcoming } = req.query;
  const now = new Date();

  let where = {
    userId,
    status: { in: ['CONFIRMED', 'CANCELLED'] }
  };

  if (upcoming === 'true') {
    where.shift = {
      distributionDate: { gte: now }
    };
  }

  const myShifts = await prisma.shiftVolunteer.findMany({
    where,
    include: {
      shift: true
    },
    orderBy: {
      shift: {
        distributionDate: 'asc'
      }
    }
  });

  res.json({
    success: true,
    data: myShifts
  });
});

// DUPLIQUER UNE PERMANENCE (ADMIN)
const duplicateShift = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newDate } = req.body;

  if (!newDate) {
    throw new HttpBadRequestError('Nouvelle date requise');
  }

  const original = await prisma.shift.findUnique({ where: { id } });

  if (!original) {
    throw new HttpNotFoundError('Permanence introuvable');
  }

  await refuseIfClosed(new Date(newDate));

  const duplicated = await prisma.shift.create({
    data: {
      distributionDate: new Date(newDate),
      startTime: original.startTime,
      endTime: original.endTime,
      volunteersNeeded: original.volunteersNeeded,
      notes: original.notes
    }
  });

  await logAudit(req, 'CREATE_SHIFT', 'IMPORTANT', {
    type: 'SHIFT',
    id: duplicated.id,
    label: duplicated.distributionDate.toISOString()
  }, { duplicatedFrom: original.id });

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Permanence dupliquée avec succès',
    data: duplicated
  });
});

export {
  getAllShifts,
  getShiftById,
  createShift,
  updateShift,
  deleteShift,
  proposeShift,
  leaveShift,
  updateVolunteerStatus,
  getPendingProposals,
  acceptProposal,
  refuseProposal,
  getMyShifts,
  duplicateShift
};