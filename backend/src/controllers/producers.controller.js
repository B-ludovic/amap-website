import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { HttpNotFoundError } from '../utils/httpErrors.js';

const publicProducerSelect = {
  id: true,
  name: true,
  specialty: true,
  description: true,
  image: true,
  isActive: true,
  city: true,
  postalCode: true,
  distanceKm: true,
  certification: true,
  farmDetailLabel: true,
  farmDetail: true,
  partnerSince: true,
  products: {
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      image: true,
    },
  },
};

// RÉCUPÉRER TOUS LES PRODUCTEURS 
const getAllProducers = asyncHandler(async (_req, res) => {
  // Récupérer seulement les producteurs actifs
  const producers = await prisma.producer.findMany({
    where: {
      isActive: true
    },
    select: publicProducerSelect,
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
    select: publicProducerSelect,
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