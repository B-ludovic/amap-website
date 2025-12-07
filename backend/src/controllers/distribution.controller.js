import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import {
  HttpNotFoundError,
  HttpBadRequestError
} from '../utils/httpErrors.js';

// LISTE D'ÉMARGEMENT
const getDistributionList = asyncHandler(async (req, res) => {
  const { weeklyBasketId } = req.params;
  const { search } = req.query;

  const weeklyBasket = await prisma.weeklyBasket.findUnique({
    where: { id: weeklyBasketId }
  });

  if (!weeklyBasket) {
    throw new HttpNotFoundError('Panier hebdomadaire introuvable');
  }

  // Récupérer tous les abonnements actifs
  const activeSubscriptions = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      startDate: { lte: weeklyBasket.distributionDate },
      endDate: { gte: weeklyBasket.distributionDate }
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true
        }
      },
      pickups: {
        where: { weeklyBasketId },
        select: {
          id: true,
          wasPickedUp: true,
          pickedUpAt: true,
          pickedUpBy: true,
          notes: true
        }
      }
    },
    orderBy: {
      user: {
        lastName: 'asc'
      }
    }
  });

  // Filtrer par recherche si besoin
  let filteredList = activeSubscriptions;

  if (search) {
    const searchLower = search.toLowerCase();
    filteredList = activeSubscriptions.filter(sub =>
      sub.user.firstName.toLowerCase().includes(searchLower) ||
      sub.user.lastName.toLowerCase().includes(searchLower) ||
      sub.user.email.toLowerCase().includes(searchLower)
    );
  }

  // Formater pour l'affichage
  const distributionList = filteredList.map(sub => {
    const pickup = sub.pickups[0] || null;
    
    return {
      subscriptionId: sub.id,
      subscriptionNumber: sub.subscriptionNumber,
      basketSize: sub.basketSize,
      user: sub.user,
      pickup: pickup ? {
        id: pickup.id,
        wasPickedUp: pickup.wasPickedUp,
        pickedUpAt: pickup.pickedUpAt,
        pickedUpBy: pickup.pickedUpBy,
        notes: pickup.notes
      } : null
    };
  });

  res.json({
    success: true,
    data: {
      weeklyBasket,
      totalSubscribers: distributionList.length,
      pickedUp: distributionList.filter(d => d.pickup?.wasPickedUp).length,
      pending: distributionList.filter(d => !d.pickup?.wasPickedUp).length,
      list: distributionList
    }
  });
});

// MARQUER COMME RÉCUPÉRÉ
const markAsPickedUp = asyncHandler(async (req, res) => {
  const { pickupId } = req.params;
  const { wasPickedUp, notes } = req.body;
  const pickedUpBy = `${req.user.firstName} ${req.user.lastName}`;

  // Chercher ou créer le pickup
  let pickup;

  if (pickupId === 'new') {
    // Créer un nouveau pickup
    const { subscriptionId, weeklyBasketId } = req.body;

    if (!subscriptionId || !weeklyBasketId) {
      throw new HttpBadRequestError('subscriptionId et weeklyBasketId requis');
    }

    const weeklyBasket = await prisma.weeklyBasket.findUnique({
      where: { id: weeklyBasketId }
    });

    pickup = await prisma.weeklyPickup.create({
      data: {
        subscriptionId,
        weeklyBasketId,
        pickupDate: weeklyBasket.distributionDate,
        wasPickedUp: wasPickedUp || false,
        pickedUpAt: wasPickedUp ? new Date() : null,
        pickedUpBy: wasPickedUp ? pickedUpBy : null,
        notes
      }
    });
  } else {
    // Mettre à jour un pickup existant
    pickup = await prisma.weeklyPickup.findUnique({
      where: { id: pickupId }
    });

    if (!pickup) {
      throw new HttpNotFoundError('Retrait introuvable');
    }

    pickup = await prisma.weeklyPickup.update({
      where: { id: pickupId },
      data: {
        wasPickedUp: wasPickedUp !== undefined ? wasPickedUp : pickup.wasPickedUp,
        pickedUpAt: wasPickedUp ? new Date() : pickup.pickedUpAt,
        pickedUpBy: wasPickedUp ? pickedUpBy : pickup.pickedUpBy,
        notes
      }
    });
  }

  res.json({
    success: true,
    message: wasPickedUp ? 'Retrait validé' : 'Retrait annulé',
    data: pickup
  });
});

// STATISTIQUES DISTRIBUTION
const getDistributionStats = asyncHandler(async (req, res) => {
  const { weeklyBasketId } = req.params;

  const weeklyBasket = await prisma.weeklyBasket.findUnique({
    where: { id: weeklyBasketId }
  });

  if (!weeklyBasket) {
    throw new HttpNotFoundError('Panier hebdomadaire introuvable');
  }

  const [totalExpected, totalPickedUp, byBasketSize] = await Promise.all([
    prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        startDate: { lte: weeklyBasket.distributionDate },
        endDate: { gte: weeklyBasket.distributionDate }
      }
    }),
    prisma.weeklyPickup.count({
      where: {
        weeklyBasketId,
        wasPickedUp: true
      }
    }),
    prisma.weeklyPickup.groupBy({
      by: ['subscription'],
      where: { weeklyBasketId, wasPickedUp: true },
      _count: true
    })
  ]);

  res.json({
    success: true,
    data: {
      totalExpected,
      totalPickedUp,
      totalPending: totalExpected - totalPickedUp,
      percentagePickedUp: totalExpected > 0 ? Math.round((totalPickedUp / totalExpected) * 100) : 0
    }
  });
});

// EXPORT LISTE (CSV)
const exportDistributionList = asyncHandler(async (req, res) => {
  const { weeklyBasketId } = req.params;

  // Récupérer la liste complète
  const result = await getDistributionList(req, res);
  
  // TODO: Générer un CSV
  // Pour l'instant, on renvoie juste le JSON

  res.json({
    success: true,
    message: 'Export disponible (TODO: générer CSV)',
    data: result.data
  });
});

export {
  getDistributionList,
  markAsPickedUp,
  getDistributionStats,
  exportDistributionList
};