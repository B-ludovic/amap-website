import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import emailService from '../services/email.service.js';
import {
    HttpNotFoundError,
    HttpBadRequestError,
    HttpConflictError,
    httpStatusCodes
} from '../utils/httpErrors.js';
import { findClosureCovering, describeClosure } from '../services/closure.service.js';
import { logAudit } from '../services/audit.service.js';

const VOLUNTEER_STATUSES = ['CONFIRMED', 'CANCELLED', 'ABSENT'];

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

  // Ajouter info : complet ou non
  const shiftsWithStatus = shifts.map(shift => ({
    ...shift,
    ...(!isAdmin && { notes: undefined }),
    isFull: shift.volunteers.filter(v => v.status === 'CONFIRMED').length >= shift.volunteersNeeded,
    confirmedCount: shift.volunteers.filter(v => v.status === 'CONFIRMED').length
  }));

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
      ...(!isAdmin && { notes: undefined })
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

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Permanence créée avec succès',
    data: shift
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
  const updatedShift = await prisma.$transaction(async (tx) => {
    if (Array.isArray(volunteers)) {
      const wantedIds = new Set(volunteers.map(v => v.userId).filter(Boolean));
      const current = await tx.shiftVolunteer.findMany({ where: { shiftId: id } });
      const currentIds = new Set(current.map(v => v.userId));

      const removed = current.filter(v => !wantedIds.has(v.userId)).map(v => v.id);
      if (removed.length > 0) {
        await tx.shiftVolunteer.deleteMany({ where: { id: { in: removed } } });
      }

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
      }
    }

    return tx.shift.update({
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
                email: true
              }
            }
          }
        }
      }
    });
  });

  await logAudit(req, 'UPDATE_SHIFT', 'IMPORTANT', {
    type: 'SHIFT',
    id,
    label: shift.distributionDate.toISOString()
  }, {
    before: { distributionDate: shift.distributionDate, volunteerIds: shift.volunteers.map(volunteer => volunteer.userId) },
    after: { distributionDate: updatedShift.distributionDate, volunteerIds: updatedShift.volunteers.map(volunteer => volunteer.userId) }
  });

  res.json({
    success: true,
    message: 'Permanence modifiée avec succès',
    data: updatedShift
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
    shift.volunteers.map((volunteer) => emailService.sendShiftCancellation(shift, volunteer.user))
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

// S'INSCRIRE À UNE PERMANENCE (ADHÉRENT)
const joinShift = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  const userId = req.user.id;

  const shift = await prisma.shift.findUnique({ where: { id } });

  if (!shift) {
    throw new HttpNotFoundError('Permanence introuvable');
  }

  await refuseIfClosed(shift.distributionDate);

  /* Compter les places puis insérer en deux requêtes séparées laissait passer
     autant d'inscriptions que de clics simultanés : chacune lisait « il reste
     une place » avant que la précédente ne soit écrite. Le verrou de ligne sur
     la permanence met les inscriptions concurrentes à la queue leu leu, si bien
     que le compte lu est toujours le compte réel.

     L'envoi de l'email reste dehors : on ne tient pas un verrou de base le
     temps d'un aller-retour SMTP. */
  const volunteer = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Shift" WHERE id = ${id} FOR UPDATE`;

    const existing = await tx.shiftVolunteer.findUnique({
      where: { shiftId_userId: { shiftId: id, userId } }
    });

    /* Une inscription annulée n'est pas une inscription : la refuser enfermait
       l'adhérent dans une impasse, puisque la contrainte d'unicité lui
       interdisait aussi d'en créer une seconde. On la réactive. */
    if (existing && existing.status !== 'CANCELLED') {
      throw new HttpConflictError('Vous êtes déjà inscrit à cette permanence');
    }

    const confirmed = await tx.shiftVolunteer.count({
      where: { shiftId: id, status: 'CONFIRMED' }
    });

    if (confirmed >= shift.volunteersNeeded) {
      throw new HttpConflictError('Cette permanence est complète');
    }

    const crewSelect = {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true }
      }
    };

    if (existing) {
      return tx.shiftVolunteer.update({
        where: { id: existing.id },
        data: { status: 'CONFIRMED', role: role || existing.role || 'Distribution' },
        include: crewSelect
      });
    }

    return tx.shiftVolunteer.create({
      data: { shiftId: id, userId, role: role || 'Distribution', status: 'CONFIRMED' },
      include: crewSelect
    });
  });

  await emailService.sendShiftConfirmation(shift, volunteer.user);

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Inscription confirmée',
    data: volunteer
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
      user: { select: { firstName: true, email: true } }
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

  // Vérifier délai (ex: 48h avant)
  const hoursBefore = (new Date(volunteer.shift.distributionDate) - new Date()) / (1000 * 60 * 60);

  if (hoursBefore < 48) {
    throw new HttpBadRequestError('Vous ne pouvez plus vous désister moins de 48h avant');
  }

  await prisma.shiftVolunteer.update({
    where: { id: volunteer.id },
    data: { status: 'CANCELLED' }
  });

  await emailService.sendShiftWithdrawal(volunteer.shift, volunteer.user);

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
  joinShift,
  leaveShift,
  updateVolunteerStatus,
  getMyShifts,
  duplicateShift
};