import { prisma } from '../config/database.js';

// VÉRIFIER LE STOCK DISPONIBLE //
const checkStockAvailability = async (basketAvailabilityId, requestedQuantity) => {
  const availability = await prisma.basketAvailability.findUnique({
    where: { id: basketAvailabilityId },
    select: {
      availableQuantity: true,
      basketType: {
        select: {
          name: true
        }
      }
    }
  });

  if (!availability) {
    return { available: false, message: 'Disponibilité introuvable' };
  }

  if (availability.availableQuantity < requestedQuantity) {
    return {
      available: false,
      message: `Stock insuffisant pour ${availability.basketType.name}. Disponible : ${availability.availableQuantity}, demandé : ${requestedQuantity}`
    };
  }

  return { available: true };
};

// RÉSERVER DU STOCK TEMPORAIREMENT //
// Utilisé quand l'utilisateur ajoute au panier
const reserveStock = async (userId, basketAvailabilityId, quantity) => {
  // Durée de réservation : 15 minutes
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  // Créer ou mettre à jour la réservation
  const reservation = await prisma.cartReservation.upsert({
    where: {
      userId_basketAvailabilityId: {
        userId,
        basketAvailabilityId
      }
    },
    update: {
      quantity,
      expiresAt
    },
    create: {
      userId,
      basketAvailabilityId,
      quantity,
      expiresAt
    }
  });

  return reservation;
};

// LIBÉRER LES RÉSERVATIONS EXPIRÉES //
// À appeler régulièrement (via un cron job par exemple)
const releaseExpiredReservations = async () => {
  const now = new Date();

  const expiredReservations = await prisma.cartReservation.deleteMany({
    where: {
      expiresAt: {
        lt: now // Less than (avant maintenant)
      }
    }
  });

  console.log(`✅ ${expiredReservations.count} réservations expirées libérées`);
  return expiredReservations.count;
};

// CALCULER LE STOCK RÉELLEMENT DISPONIBLE //
// (stock disponible - réservations actives)
const getAvailableStock = async (basketAvailabilityId) => {
  const availability = await prisma.basketAvailability.findUnique({
    where: { id: basketAvailabilityId },
    select: {
      availableQuantity: true
    }
  });

  if (!availability) {
    return 0;
  }

  // Calculer le total des réservations actives
  const activeReservations = await prisma.cartReservation.aggregate({
    where: {
      basketAvailabilityId,
      expiresAt: {
        gt: new Date() // Greater than (après maintenant)
      }
    },
    _sum: {
      quantity: true
    }
  });

  const reservedQuantity = activeReservations._sum.quantity || 0;
  const actuallyAvailable = availability.availableQuantity - reservedQuantity;

  return Math.max(0, actuallyAvailable);
};

export default {
  checkStockAvailability,
  reserveStock,
  releaseExpiredReservations,
  getAvailableStock
};

export {
  checkStockAvailability,
  reserveStock,
  releaseExpiredReservations,
  getAvailableStock
};