import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import {
  HttpNotFoundError,
  HttpBadRequestError
} from '../utils/httpErrors.js';

// REQUÊTE PARTAGÉE
async function fetchDistributionData(weeklyBasketId) {
  const weeklyBasket = await prisma.weeklyBasket.findUnique({
    where: { id: weeklyBasketId }
  });

  if (!weeklyBasket) throw new HttpNotFoundError('Panier hebdomadaire introuvable');

  const activeSubscriptions = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      startDate: { lte: weeklyBasket.distributionDate },
      endDate: { gte: weeklyBasket.distributionDate },
      user: { deletedAt: null }
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
    orderBy: { user: { lastName: 'asc' } }
  });

  return { weeklyBasket, activeSubscriptions };
}

// LISTE D'ÉMARGEMENT
const getDistributionList = asyncHandler(async (req, res) => {
  const { weeklyBasketId } = req.params;
  const { search } = req.query;

  const { weeklyBasket, activeSubscriptions } = await fetchDistributionData(weeklyBasketId);

  let filteredList = activeSubscriptions;

  if (search) {
    const searchLower = search.toLowerCase();
    filteredList = activeSubscriptions.filter(sub =>
      sub.user.firstName.toLowerCase().includes(searchLower) ||
      sub.user.lastName.toLowerCase().includes(searchLower) ||
      sub.user.email.toLowerCase().includes(searchLower)
    );
  }

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

  const [totalExpected, totalPickedUp] = await Promise.all([
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

  const { weeklyBasket, activeSubscriptions } = await fetchDistributionData(weeklyBasketId);

  const escape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  const header = ['N° abonnement', 'Nom', 'Prénom', 'Email', 'Téléphone', 'Panier', 'Récupéré', 'Heure de récupération', 'Notes'];

  const rows = activeSubscriptions.map(sub => {
    const pickup = sub.pickups[0] || null;
    const basket = sub.basketSize === 'SMALL' ? 'Petit' : 'Grand';
    const pickedUp = pickup?.wasPickedUp ? 'Oui' : 'Non';
    const pickedUpAt = pickup?.pickedUpAt ? new Date(pickup.pickedUpAt).toLocaleString('fr-FR') : '';
    return [
      sub.subscriptionNumber,
      sub.user.lastName,
      sub.user.firstName,
      sub.user.email,
      sub.user.phone || '',
      basket,
      pickedUp,
      pickedUpAt,
      pickup?.notes || ''
    ].map(escape).join(',');
  });

  const csv = [header.map(escape).join(','), ...rows].join('\r\n');
  const filename = `distribution_${weeklyBasket.distributionDate.toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + csv);
});

export {
  getDistributionList,
  markAsPickedUp,
  getDistributionStats,
  exportDistributionList
};
