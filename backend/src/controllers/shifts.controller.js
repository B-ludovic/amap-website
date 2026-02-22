import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import {
    HttpNotFoundError,
    HttpBadRequestError,
    HttpConflictError,
    httpStatusCodes
} from '../utils/httpErrors.js';

// RÉCUPÉRER TOUTES LES PERMANENCES
const getAllShifts = asyncHandler(async (req, res) => {
  const { upcoming, past, limit = 20 } = req.query;
  const now = new Date();

  let where = {};

  if (upcoming === 'true') {
    where.distributionDate = { gte: now };
  } else if (past === 'true') {
    where.distributionDate = { lt: now };
  }

  const shifts = await prisma.shift.findMany({
    where,
    take: parseInt(limit),
    include: {
      volunteers: {
        where: { user: { deletedAt: null } },
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
    },
    orderBy: {
      distributionDate: upcoming === 'true' ? 'asc' : 'desc'
    }
  });

  // Ajouter info : complet ou non
  const shiftsWithStatus = shifts.map(shift => ({
    ...shift,
    isFull: shift.volunteers.filter(v => v.status === 'CONFIRMED').length >= shift.volunteersNeeded,
    confirmedCount: shift.volunteers.filter(v => v.status === 'CONFIRMED').length
  }));

  res.json({
    success: true,
    data: shiftsWithStatus
  });
});

// RÉCUPÉRER UNE PERMANENCE
const getShiftById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const shift = await prisma.shift.findUnique({
    where: { id },
    include: {
      volunteers: {
        where: { user: { deletedAt: null } },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true
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
    data: shift
  });
});

// CRÉER UNE PERMANENCE (ADMIN)
const createShift = asyncHandler(async (req, res) => {
  const { distributionDate, startTime, endTime, volunteersNeeded, notes, volunteers } = req.body;

  if (!distributionDate) {
    throw new HttpBadRequestError('Date de distribution requise');
  }

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

  const shift = await prisma.shift.findUnique({ where: { id } });

  if (!shift) {
    throw new HttpNotFoundError('Permanence introuvable');
  }

  // Si des bénévoles sont fournis, supprimer les anciens et créer les nouveaux
  if (volunteers && Array.isArray(volunteers)) {
    await prisma.shiftVolunteer.deleteMany({
      where: { shiftId: id }
    });

    if (volunteers.length > 0) {
      await prisma.shiftVolunteer.createMany({
        data: volunteers.map(v => ({
          shiftId: id,
          userId: v.userId,
          status: v.status || 'CONFIRMED'
        }))
      });
    }
  }

  const updatedShift = await prisma.shift.update({
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
    include: { volunteers: true }
  });

  if (!shift) {
    throw new HttpNotFoundError('Permanence introuvable');
  }

  // TODO: Envoyer email aux bénévoles inscrits

  await prisma.shift.delete({ where: { id } });

  res.json({
    success: true,
    message: 'Permanence supprimée avec succès'
  });
});

// S'INSCRIRE À UNE PERMANENCE (ADHÉRENT)
const joinShift = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  const userId = req.user.id;

  const shift = await prisma.shift.findUnique({
    where: { id },
    include: {
      volunteers: {
        where: { status: 'CONFIRMED' }
      }
    }
  });

  if (!shift) {
    throw new HttpNotFoundError('Permanence introuvable');
  }

  // Vérifier si complet
  if (shift.volunteers.length >= shift.volunteersNeeded) {
    throw new HttpConflictError('Cette permanence est complète');
  }

  // Vérifier si déjà inscrit
  const existingVolunteer = await prisma.shiftVolunteer.findUnique({
    where: {
      shiftId_userId: {
        shiftId: id,
        userId
      }
    }
  });

  if (existingVolunteer) {
    throw new HttpConflictError('Vous êtes déjà inscrit à cette permanence');
  }

  const volunteer = await prisma.shiftVolunteer.create({
    data: {
      shiftId: id,
      userId,
      role: role || 'Distribution',
      status: 'CONFIRMED'
    },
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
  });

  // TODO: Envoyer email de confirmation

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

  const volunteer = await prisma.shiftVolunteer.findUnique({
    where: {
      shiftId_userId: {
        shiftId: id,
        userId
      }
    }
  });

  if (!volunteer) {
    throw new HttpNotFoundError('Inscription introuvable');
  }

  // Vérifier délai (ex: 48h avant)
  const shift = await prisma.shift.findUnique({ where: { id } });
  const hoursBefore = (new Date(shift.distributionDate) - new Date()) / (1000 * 60 * 60);

  if (hoursBefore < 48) {
    throw new HttpBadRequestError('Vous ne pouvez plus vous désister moins de 48h avant');
  }

  await prisma.shiftVolunteer.update({
    where: { id: volunteer.id },
    data: { status: 'CANCELLED' }
  });

  // TODO: Envoyer email d'annulation

  res.json({
    success: true,
    message: 'Désinscription confirmée'
  });
});

// MARQUER UN BÉNÉVOLE ABSENT (ADMIN)
const markVolunteerAbsent = asyncHandler(async (req, res) => {
  const { shiftId, volunteerId } = req.params;

  const volunteer = await prisma.shiftVolunteer.findUnique({
    where: {
      shiftId_userId: {
        shiftId,
        userId: volunteerId
      }
    }
  });

  if (!volunteer) {
    throw new HttpNotFoundError('Bénévole introuvable');
  }

  await prisma.shiftVolunteer.update({
    where: { id: volunteer.id },
    data: { status: 'ABSENT' }
  });

  res.json({
    success: true,
    message: 'Statut mis à jour'
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

  const duplicated = await prisma.shift.create({
    data: {
      distributionDate: new Date(newDate),
      startTime: original.startTime,
      endTime: original.endTime,
      volunteersNeeded: original.volunteersNeeded,
      notes: original.notes
    }
  });

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
  markVolunteerAbsent,
  getMyShifts,
  duplicateShift
};