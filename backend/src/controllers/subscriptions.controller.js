import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import emailService from '../services/email.service.js';
import contractService from '../services/contract.service.js';
import { z } from 'zod';
import {
  HttpNotFoundError,
  HttpBadRequestError,
  HttpConflictError,
  HttpForbiddenError,
  httpStatusCodes
} from '../utils/httpErrors.js';
import { logAudit } from '../services/audit.service.js';
import { computeRemainingPickups } from '../utils/subscriptionSchedule.js';
import { computeSubscriptionPrice, getPricingGrid } from '../utils/subscriptionPricing.js';

const SubscriptionTypeSchema = z.enum(['ANNUAL', 'DISCOVERY']);
const BasketSizeSchema = z.enum(['SMALL', 'LARGE']);
const PricingTypeSchema = z.enum(['NORMAL', 'SOLIDARITY']);
const emptyToUndefined = (value) => (value === '' || value === null ? undefined : value);
const DateSchema = z.preprocess(emptyToUndefined, z.coerce.date());
const OptionalDateSchema = z.preprocess(emptyToUndefined, z.coerce.date().optional());
const OptionalAmountSchema = z.preprocess(
  emptyToUndefined,
  z.coerce.number().finite().min(0).optional()
);

const CreateSubscriptionSchema = z.object({
  userId: z.string().min(1, 'Utilisateur requis'),
  type: SubscriptionTypeSchema,
  basketSize: BasketSizeSchema,
  pricingType: PricingTypeSchema.optional().default('NORMAL'),
  startDate: DateSchema,
  endDate: DateSchema,
  pickupLocationId: z.string().min(1, 'Point de retrait requis')
}).refine(({ startDate, endDate }) => endDate > startDate, {
  message: 'La date de fin doit être postérieure à la date de début',
  path: ['endDate']
});

const UpdateSubscriptionSchema = z.object({
  basketSize: BasketSizeSchema.optional(),
  pricingType: PricingTypeSchema.optional(),
  endDate: OptionalDateSchema,
  price: OptionalAmountSchema,
  paidAmount: OptionalAmountSchema
});

// Générer un numéro d'abonnement unique
const generateSubscriptionNumber = async () => {
  const year = new Date().getFullYear();
  const count = await prisma.subscription.count({
    where: {
      subscriptionNumber: {
        startsWith: `SUB-${year}-`
      }
    }
  });
  const number = (count + 1).toString().padStart(3, '0');
  return `SUB-${year}-${number}`;
};

// GRILLE TARIFAIRE (PUBLIC)
// Le formulaire d'abonnement affichait sa propre copie des prix, qui a fini par
// diverger de celle du serveur. Il la lit désormais ici : une seule table décide
// à la fois de ce qu'on annonce et de ce qui est facturé.
const getPricing = asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: { pricing: getPricingGrid() }
  });
});

// RÉCUPÉRER TOUTES LES DEMANDES D'ABONNEMENT (ADMIN)
const getSubscriptionRequests = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const parsedPage = Math.max(parseInt(page) || 1, 1);
  const parsedLimit = Math.min(parseInt(limit) || 20, 100);

  const skip = (parsedPage - 1) * parsedLimit;

  let where = {};

  if (status) {
    where.status = status;
  }

  const [requests, total] = await Promise.all([
    prisma.subscriptionRequest.findMany({
      where,
      skip,
      take: parsedLimit,
      orderBy: {
        createdAt: 'desc'
      }
    }),
    prisma.subscriptionRequest.count({ where })
  ]);

  res.json({
    success: true,
    data: {
      requests,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit)
      }
    }
  });
});

// RÉCUPÉRER TOUS LES ABONNEMENTS (ADMIN)
const getAllSubscriptions = asyncHandler(async (req, res) => {
  const { status, type, pricingType, search, page = 1, limit = 20 } = req.query;
  const parsedPage = Math.max(parseInt(page) || 1, 1);
  const parsedLimit = Math.min(parseInt(limit) || 20, 100);

  const skip = (parsedPage - 1) * parsedLimit;

  let where = {};

  if (status) {
    where.status = status;
  }

  if (type) {
    where.type = type;
  }

  if (pricingType) {
    where.pricingType = pricingType;
  }

  /* Recherche sur le numéro de contrat et sur l'identité de l'adhérent. Elle
     doit passer par la base : la liste est paginée, filtrer les seuls contrats
     déjà chargés ne verrait que la page en cours. */
  const trimmedSearch = typeof search === 'string' ? search.trim() : '';

  if (trimmedSearch) {
    where.OR = [
      { subscriptionNumber: { contains: trimmedSearch, mode: 'insensitive' } },
      { user: { firstName: { contains: trimmedSearch, mode: 'insensitive' } } },
      { user: { lastName: { contains: trimmedSearch, mode: 'insensitive' } } },
      { user: { email: { contains: trimmedSearch, mode: 'insensitive' } } }
    ];
  }

  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      skip,
      take: parsedLimit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true
          }
        },
        pickupLocation: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true
          }
        },
        _count: {
          select: {
            pickups: true
          }
        },
        pauses: {
          select: { startDate: true, endDate: true },
          orderBy: { endDate: 'desc' }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    }),
    prisma.subscription.count({ where })
  ]);

  // Auto-reprise : passer ACTIVE les abonnements dont la pause est expirée
  const now = new Date();
  const toResume = subscriptions.filter(s =>
    s.status === 'PAUSED' && s.pauses.length > 0 && new Date(s.pauses[0].endDate) < now
  );
  if (toResume.length > 0) {
    await prisma.subscription.updateMany({
      where: { id: { in: toResume.map(s => s.id) } },
      data: { status: 'ACTIVE' }
    });
    toResume.forEach(s => { s.status = 'ACTIVE'; });
  }

  const subscriptionsWithRemaining = subscriptions.map(sub => ({
    ...sub,
    pickupsRemaining: computeRemainingPickups({
      startDate: sub.startDate,
      endDate: sub.endDate,
      pickupsDone: sub._count.pickups
    })
  }));

  res.json({
    success: true,
    data: {
      subscriptions: subscriptionsWithRemaining,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit)
      }
    }
  });
});

// RÉCUPÉRER UN ABONNEMENT (ADMIN)
const getSubscriptionById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const subscription = await prisma.subscription.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          /* Permanences tenues par l'adhérent : la fiche de contrat les
             affiche, or elles pendent à l'utilisateur et non au contrat. */
          _count: { select: { shiftVolunteers: true } }
        }
      },
      pickupLocation: true,
      pickups: {
        include: {
          weeklyBasket: {
            select: {
              weekNumber: true,
              year: true,
              distributionDate: true
            }
          }
        },
        orderBy: {
          pickupDate: 'desc'
        },
        take: 10
      },
      pauses: {
        orderBy: {
          startDate: 'desc'
        }
      },
      payments: {
        orderBy: {
          createdAt: 'desc'
        }
      }
    }
  });

  if (!subscription) {
    throw new HttpNotFoundError('Abonnement introuvable');
  }

  /* `pickups` est tronqué aux dix derniers pour l'affichage : le décompte des
     retraits effectués se lit sur la table, pas sur la longueur du tableau. */
  const pickupsDone = await prisma.weeklyPickup.count({
    where: { subscriptionId: id }
  });

  res.json({
    success: true,
    data: {
      ...subscription,
      pickupsDone,
      pickupsRemaining: computeRemainingPickups({
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        pickupsDone
      })
    }
  });
});

// CRÉER UN ABONNEMENT (ADMIN - après validation demande)
const createSubscription = asyncHandler(async (req, res) => {
  const parsed = CreateSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpBadRequestError(parsed.error.errors[0].message);

  const { userId, type, basketSize, pricingType, startDate, endDate, pickupLocationId } = parsed.data;

  // Vérifier que l'utilisateur existe
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new HttpNotFoundError('Utilisateur introuvable');
  }

  // Vérifier que le point de retrait existe
  const pickupLocation = await prisma.pickupLocation.findUnique({
    where: { id: pickupLocationId }
  });

  if (!pickupLocation) {
    throw new HttpNotFoundError('Point de retrait introuvable');
  }

  // Générer le numéro d'abonnement
  const subscriptionNumber = await generateSubscriptionNumber();

  const subscription = await prisma.subscription.create({
    data: {
      userId,
      subscriptionNumber,
      type,
      basketSize,
      pricingType: pricingType || 'NORMAL',
      status: 'ACTIVE',
      startDate,
      endDate,
      price: computeSubscriptionPrice({ type, basketSize, pricingType }),
      paidAmount: 0,
      pickupLocationId
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true
        }
      },
      pickupLocation: true
    }
  });

  // Envoyer email de confirmation à l'adhérent
  await emailService.sendSubscriptionConfirmation(subscription, user);

  await logAudit(req, 'CREATE_SUBSCRIPTION', 'IMPORTANT', {
    type: 'SUBSCRIPTION',
    id: subscription.id,
    label: subscription.subscriptionNumber
  }, {
    price: subscription.price,
    pricingType: subscription.pricingType,
    startDate: subscription.startDate,
    endDate: subscription.endDate
  });

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Abonnement créé avec succès',
    data: subscription
  });
});

// MODIFIER UN ABONNEMENT (ADMIN)
const updateSubscription = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const subscription = await prisma.subscription.findUnique({ where: { id } });

  if (!subscription) {
    throw new HttpNotFoundError('Abonnement introuvable');
  }

  const parsed = UpdateSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpBadRequestError(parsed.error.errors[0].message);

  const { basketSize, pricingType, endDate, price, paidAmount } = parsed.data;

  if (endDate && endDate <= subscription.startDate) {
    throw new HttpBadRequestError('La date de fin doit être postérieure à la date de début');
  }

  const updated = await prisma.subscription.update({
    where: { id },
    data: {
      ...(basketSize && { basketSize }),
      ...(pricingType && { pricingType }),
      ...(endDate && { endDate }),
      ...(price !== undefined && { price }),
      ...(paidAmount !== undefined && { paidAmount })
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true
        }
      }
    }
  });

  await logAudit(req, 'UPDATE_SUBSCRIPTION', 'IMPORTANT', {
    type: 'SUBSCRIPTION',
    id,
    label: subscription.subscriptionNumber
  }, {
    before: {
      basketSize: subscription.basketSize,
      pricingType: subscription.pricingType,
      endDate: subscription.endDate,
      price: subscription.price,
      paidAmount: subscription.paidAmount
    },
    after: {
      basketSize: updated.basketSize,
      pricingType: updated.pricingType,
      endDate: updated.endDate,
      price: updated.price,
      paidAmount: updated.paidAmount
    }
  });

  res.json({
    success: true,
    message: 'Abonnement modifié avec succès',
    data: updated
  });
});

// ACTIVER UN ABONNEMENT (ADMIN) - PENDING → ACTIVE
const activateSubscription = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const subscription = await prisma.subscription.findUnique({ where: { id } });

  if (!subscription) {
    throw new HttpNotFoundError('Abonnement introuvable');
  }

  if (subscription.status !== 'PENDING') {
    throw new HttpBadRequestError('Seuls les abonnements en attente peuvent être activés');
  }

  const activated = await prisma.subscription.update({
    where: { id },
    data: { status: 'ACTIVE' }
  });

  await logAudit(req, 'ACTIVATE_SUBSCRIPTION', 'IMPORTANT', {
    type: 'SUBSCRIPTION',
    id,
    label: subscription.subscriptionNumber
  }, { before: { status: subscription.status }, after: { status: activated.status } });

  res.json({
    success: true,
    message: 'Abonnement activé avec succès',
    data: activated
  });
});

// ANNULER UN ABONNEMENT (ADMIN)
const cancelSubscription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const subscription = await prisma.subscription.findUnique({ where: { id } });

  if (!subscription) {
    throw new HttpNotFoundError('Abonnement introuvable');
  }

  if (subscription.status === 'CANCELLED') {
    throw new HttpConflictError('Cet abonnement est déjà annulé');
  }

  const cancelled = await prisma.subscription.update({
    where: { id },
    data: {
      status: 'CANCELLED'
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true
        }
      }
    }
  });

  await emailService.sendSubscriptionCancellation(cancelled, cancelled.user);

  await logAudit(req, 'CANCEL_SUBSCRIPTION', 'IMPORTANT', { type: 'SUBSCRIPTION', id, label: subscription.subscriptionNumber });

  res.json({
    success: true,
    message: 'Abonnement annulé avec succès',
    data: cancelled
  });
});

// METTRE EN PAUSE UN ABONNEMENT (ADMIN)
const pauseSubscription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate, reason } = req.body;

  if (!startDate || !endDate) {
    throw new HttpBadRequestError('Dates de début et fin de pause requises');
  }

  const pauseStartDate = new Date(startDate);
  const pauseEndDate = new Date(endDate);

  if (Number.isNaN(pauseStartDate.getTime()) || Number.isNaN(pauseEndDate.getTime())) {
    throw new HttpBadRequestError('Dates de pause invalides');
  }

  if (pauseEndDate <= pauseStartDate) {
    throw new HttpBadRequestError('La date de fin de pause doit être postérieure à la date de début');
  }

  const subscription = await prisma.subscription.findUnique({ where: { id } });

  if (!subscription) {
    throw new HttpNotFoundError('Abonnement introuvable');
  }

  if (subscription.status !== 'ACTIVE') {
    throw new HttpBadRequestError('Seuls les abonnements actifs peuvent être mis en pause');
  }

  // Vérifier la limite de 2 semaines (14 jours) au total
  const existingPauses = await prisma.subscriptionPause.findMany({ where: { subscriptionId: id } });
  const daysUsed = existingPauses.reduce((sum, p) =>
    sum + Math.round((new Date(p.endDate) - new Date(p.startDate)) / 86400000), 0
  );
  const daysRequested = Math.round((pauseEndDate - pauseStartDate) / 86400000);
  if (daysUsed + daysRequested > 14) {
    throw new HttpBadRequestError(
      `Limite de 2 semaines de pause atteinte. Jours déjà utilisés : ${daysUsed}/14`
    );
  }

  // Créer la pause
  const pause = await prisma.subscriptionPause.create({
    data: {
      subscriptionId: id,
      startDate: pauseStartDate,
      endDate: pauseEndDate,
      reason
    }
  });

  // Mettre à jour le statut
  await prisma.subscription.update({
    where: { id },
    data: { status: 'PAUSED' }
  });

  res.json({
    success: true,
    message: 'Abonnement mis en pause avec succès',
    data: pause
  });
});

// REPRENDRE UN ABONNEMENT (ADMIN)
const resumeSubscription = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const subscription = await prisma.subscription.findUnique({ where: { id } });

  if (!subscription) {
    throw new HttpNotFoundError('Abonnement introuvable');
  }

  if (subscription.status !== 'PAUSED') {
    throw new HttpBadRequestError('Seuls les abonnements en pause peuvent être repris');
  }

  const resumed = await prisma.subscription.update({
    where: { id },
    data: { status: 'ACTIVE' }
  });

  res.json({
    success: true,
    message: 'Abonnement réactivé avec succès',
    data: resumed
  });
});

// MON ABONNEMENT (ADHÉRENT)
const getMySubscription = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['ACTIVE', 'PAUSED'] }
    },
    include: {
      pickupLocation: true,
      pickups: {
        include: {
          weeklyBasket: {
            select: {
              weekNumber: true,
              year: true,
              distributionDate: true
            }
          }
        },
        orderBy: {
          pickupDate: 'desc'
        },
        take: 5
      },
      // Toutes les pauses de la saison, passées comprises : l'espace adhérent
      // affiche le solde de semaines restantes, qui serait faux si les pauses
      // déjà écoulées étaient filtrées.
      pauses: {
        orderBy: { startDate: 'asc' }
      }
    }
  });

  if (!subscription) {
    return res.json({
      success: true,
      message: 'Aucun abonnement actif',
      data: null
    });
  }

  res.json({
    success: true,
    data: subscription
  });
});

// STATISTIQUES ABONNEMENTS (ADMIN)
const getSubscriptionStats = asyncHandler(async (req, res) => {
  const [
    totalActive,
    totalPaused,
    totalCancelled,
    byType,
    bySize,
    solidarityCount,
    totalRevenue
  ] = await Promise.all([
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.subscription.count({ where: { status: 'PAUSED' } }),
    prisma.subscription.count({ where: { status: 'CANCELLED' } }),
    prisma.subscription.groupBy({
      by: ['type'],
      where: { status: 'ACTIVE' },
      _count: true
    }),
    prisma.subscription.groupBy({
      by: ['basketSize'],
      where: { status: 'ACTIVE' },
      _count: true
    }),
    prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        pricingType: 'SOLIDARITY'
      }
    }),
    prisma.subscription.aggregate({
      where: { status: { in: ['ACTIVE', 'PAUSED'] } },
      _sum: { paidAmount: true }
    })
  ]);

  res.json({
    success: true,
    data: {
      active: totalActive,
      paused: totalPaused,
      cancelled: totalCancelled,
      byType,
      bySize,
      solidarity: solidarityCount,
      revenue: totalRevenue._sum.paidAmount || 0
    }
  });
});

// GÉNÉRER LE CONTRAT PDF D'UN ABONNEMENT (ADMIN, OU L'ADHÉRENT SUR LE SIEN)
const generateContractFromSubscription = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // 1. Récupérer l'abonnement avec les relations nécessaires
  const subscription = await prisma.subscription.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          address: true
        }
      },
      pickupLocation: true
    }
  });

  if (!subscription) {
    throw new HttpNotFoundError('Abonnement introuvable');
  }

  // Un adhérent ne peut télécharger que son propre contrat
  if (req.user.role !== 'ADMIN' && subscription.userId !== req.user.id) {
    throw new HttpForbiddenError('Accès refusé à ce contrat');
  }

  // 2. Retrouver la demande associée pour récupérer le paymentType
  const request = await prisma.subscriptionRequest.findFirst({
    where: {
      email: subscription.user.email,
      type: subscription.type,
      basketSize: subscription.basketSize,
      status: 'APPROVED'
    },
    orderBy: { createdAt: 'desc' }
  });

  const paymentType = request?.paymentType ?? '1';

  // 3. Générer le PDF
  const pdfBuffer = await contractService.generateContract(subscription, subscription.user, paymentType);

  // 4. Renvoyer le PDF en inline pour affichage dans le navigateur
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Contrat_${subscription.subscriptionNumber}_${subscription.user.lastName}.pdf"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.setHeader('Cache-Control', 'no-cache');

  res.end(pdfBuffer, 'binary');
});

export {
  getAllSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  activateSubscription,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  getMySubscription,
  getPricing,
  getSubscriptionRequests,
  getSubscriptionStats,
  generateContractFromSubscription
};