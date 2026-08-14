import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';

// CHIFFRES PUBLICS DE L'ASSOCIATION
// Seuls des agrégats sont exposés : aucun détail nominatif ne sort d'ici.
// Un foyer en pause reste adhérent, il est donc compté avec les actifs.
const getPublicStats = asyncHandler(async (_req, res) => {
  const [households, producers] = await Promise.all([
    prisma.subscription.count({
      where: { status: { in: ['ACTIVE', 'PAUSED'] } }
    }),
    prisma.producer.count({
      where: { isActive: true }
    })
  ]);

  res.json({
    success: true,
    data: {
      households,
      producers
    }
  });
});

export { getPublicStats };
