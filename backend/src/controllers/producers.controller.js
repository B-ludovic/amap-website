import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { HttpNotFoundError } from '../utils/httpErrors.js';

// RÉCUPÉRER TOUS LES PRODUCTEURS 
const getAllProducers = asyncHandler(async (req, res) => {
  // Récupérer seulement les producteurs actifs
  const producers = await prisma.producer.findMany({
    where: {
      isActive: true
    },
    // Inclure leurs produits aussi
    include: {
      products: {
        where: {
          deletedAt: null // Exclure les produits soft deleted
        },
        select: {
          id: true,
          name: true,
          description: true,
          unit: true,
          origin: true,
          image: true,
        }
      }
    },
    orderBy: {
      name: 'asc' // Tri par ordre alphabétique
    }
  });

  res.json({
    success: true,
    data: {
      producers,
      count: producers.length
    }
  });
});

// RÉCUPÉRER UN PRODUCTEUR PAR SON ID
const getProducerById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const producer = await prisma.producer.findUnique({
    where: { id },
    include: {
      products: {
        where: {
          deletedAt: null // Exclure les produits soft deleted
        },
        select: {
          id: true,
          name: true,
          description: true,
          unit: true,
          origin: true,
          image: true,
          createdAt: true,
        }
      }
    }
  });

  // Si le producteur n'existe pas
  if (!producer) {
    throw new HttpNotFoundError('Producteur introuvable');
  }

  // Si le producteur est désactivé, on ne le montre pas au public
  if (!producer.isActive) {
    throw new HttpNotFoundError('Producteur introuvable');
  }

  res.json({
    success: true,
    data: { producer }
  });
});

export { getAllProducers, getProducerById };