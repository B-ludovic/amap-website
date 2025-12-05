import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { HttpNotFoundError, HttpBadRequestError } from '../utils/httpErrors.js';

// RÉCUPÉRER TOUS LES TYPES DE PANIERS 
const getAllBasketTypes = asyncHandler(async (req, res) => {
  // Récupérer seulement les paniers actifs
  const basketTypes = await prisma.basketType.findMany({
    where: {
      isActive: true
    },
    include: {
      // Inclure les produits du panier
      products: {
        include: {
          product: {
            where: {
              deletedAt: null // Exclure les produits soft deleted
            },
            include: {
              producer: {
                select: {
                  id: true,
                  name: true,
                  specialty: true
                }
              }
            }
          }
        }
      }
    },
    orderBy: {
      price: 'asc' // Du moins cher au plus cher
    }
  });

  res.json({
    success: true,
    data: {
      basketTypes,
      count: basketTypes.length
    }
  });
});

// RÉCUPÉRER UN TYPE DE PANIER PAR SON ID 
const getBasketTypeById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const basketType = await prisma.basketType.findUnique({
    where: { id },
    include: {
      products: {
        include: {
          product: {
            where: {
              deletedAt: null
            },
            include: {
              producer: {
                select: {
                  id: true,
                  name: true,
                  specialty: true,
                  image: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!basketType) {
    throw new HttpNotFoundError('Type de panier introuvable');
  }

  if (!basketType.isActive) {
    throw new HttpNotFoundError('Type de panier introuvable');
  }

  res.json({
    success: true,
    data: { basketType }
  });
});

// RÉCUPÉRER LES PANIERS DISPONIBLES 
// Avec filtres : date de distribution, point de retrait
const getAvailableBaskets = asyncHandler(async (req, res) => {
  const { distributionDate, pickupLocationId } = req.query;

  // Vérifier que les paramètres requis sont présents
  if (!distributionDate || !pickupLocationId) {
    throw new HttpBadRequestError('Date de distribution et point de retrait requis');
  }

  // Vérifier que la date est valide
  const date = new Date(distributionDate);
  if (isNaN(date.getTime())) {
    throw new HttpBadRequestError('Format de date invalide');
  }

  // Récupérer les paniers disponibles
  const availableBaskets = await prisma.basketAvailability.findMany({
    where: {
      distributionDate: date,
      pickupLocationId: pickupLocationId,
      availableQuantity: {
        gt: 0 // Seulement ceux qui ont du stock (greater than 0)
      },
      basketType: {
        isActive: true // Seulement les types de paniers actifs
      }
    },
    include: {
      basketType: {
        include: {
          products: {
            include: {
              product: {
                where: {
                  deletedAt: null
                },
                include: {
                  producer: {
                    select: {
                      id: true,
                      name: true
                    }
                  }
                }
              }
            }
          }
        }
      },
      pickupLocation: {
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          postalCode: true
        }
      }
    },
    orderBy: {
      basketType: {
        price: 'asc'
      }
    }
  });

  res.json({
    success: true,
    data: {
      availableBaskets,
      count: availableBaskets.length,
      filters: {
        distributionDate: distributionDate,
        pickupLocationId: pickupLocationId
      }
    }
  });
});

export { getAllBasketTypes, getBasketTypeById, getAvailableBaskets };