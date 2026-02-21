import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import emailService from '../services/email.service.js';
import contractService from '../services/contract.service.js';
import {
  HttpNotFoundError,
  HttpBadRequestError,
  HttpConflictError,
  httpStatusCodes
} from '../utils/httpErrors.js';

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

// SOUMETTRE UNE DEMANDE D'ABONNEMENT (PUBLIC)
const submitSubscriptionRequest = asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    type,
    basketSize,
    pricingType,
    message
  } = req.body;

  // Validation
  if (!firstName || !lastName || !email || !phone || !type || !basketSize) {
    throw new HttpBadRequestError('Tous les champs obligatoires doivent être remplis');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpBadRequestError('Email invalide');
  }

  // Vérifier que l'utilisateur n'a pas déjà une demande en attente
  const existingRequest = await prisma.subscriptionRequest.findFirst({
    where: {
      email,
      status: 'PENDING'
    }
  });

  if (existingRequest) {
    throw new HttpConflictError('Vous avez déjà une demande en attente');
  }

  const request = await prisma.subscriptionRequest.create({
    data: {
      firstName,
      lastName,
      email,
      phone,
      type,
      basketSize,
      pricingType: pricingType || 'NORMAL',
      message
    }
  });

  // TODO: Envoyer email de confirmation au demandeur
  // TODO: Notifier les admins

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Votre demande a été envoyée avec succès. Nous vous recontacterons rapidement pour finaliser votre inscription.',
    data: request
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
  const { status, type, pricingType, page = 1, limit = 20 } = req.query;
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
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    }),
    prisma.subscription.count({ where })
  ]);

  res.json({
    success: true,
    data: {
      subscriptions,
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
          phone: true
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

  res.json({
    success: true,
    data: subscription
  });
});

// CRÉER UN ABONNEMENT (ADMIN - après validation demande)
const createSubscription = asyncHandler(async (req, res) => {
  const {
    userId,
    type,
    basketSize,
    pricingType,
    startDate,
    endDate,
    price,
    pickupLocationId
  } = req.body;

  if (!userId || !type || !basketSize || !startDate || !endDate || !price || !pickupLocationId) {
    throw new HttpBadRequestError('Tous les champs requis doivent être remplis');
  }

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
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      price: parseFloat(price),
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

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Abonnement créé avec succès',
    data: subscription
  });
});

// MODIFIER UN ABONNEMENT (ADMIN)
const updateSubscription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { basketSize, pricingType, endDate, price, paidAmount } = req.body;

  const subscription = await prisma.subscription.findUnique({ where: { id } });

  if (!subscription) {
    throw new HttpNotFoundError('Abonnement introuvable');
  }

  const updated = await prisma.subscription.update({
    where: { id },
    data: {
      ...(basketSize && { basketSize }),
      ...(pricingType && { pricingType }),
      ...(endDate && { endDate: new Date(endDate) }),
      ...(price && { price: parseFloat(price) }),
      ...(paidAmount !== undefined && { paidAmount: parseFloat(paidAmount) })
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

  res.json({
    success: true,
    message: 'Abonnement modifié avec succès',
    data: updated
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

  // TODO: Envoyer email d'annulation

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

  const subscription = await prisma.subscription.findUnique({ where: { id } });

  if (!subscription) {
    throw new HttpNotFoundError('Abonnement introuvable');
  }

  if (subscription.status !== 'ACTIVE') {
    throw new HttpBadRequestError('Seuls les abonnements actifs peuvent être mis en pause');
  }

  // Créer la pause
  const pause = await prisma.subscriptionPause.create({
    data: {
      subscriptionId: id,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
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
      pauses: {
        where: {
          endDate: { gte: new Date() }
        }
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

// GÉNÉRER LE CONTRAT PDF D'UN ABONNEMENT (ADMIN)
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
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  getMySubscription,
  submitSubscriptionRequest,
  getSubscriptionRequests,
  getSubscriptionStats,
  generateContractFromSubscription
};