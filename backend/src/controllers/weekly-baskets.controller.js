import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import {
  HttpNotFoundError,
  HttpBadRequestError,
  HttpConflictError,
  httpStatusCodes
} from '../utils/httpErrors.js';

// RÉCUPÉRER TOUS LES PANIERS HEBDOMADAIRES
const getAllWeeklyBaskets = asyncHandler(async (req, res) => {
  const { year, published, limit = 20 } = req.query;

  let where = {};

  if (year) {
    where.year = parseInt(year);
  }

  if (published === 'true') {
    where.isPublished = true;
  } else if (published === 'false') {
    where.isPublished = false;
  }

  const baskets = await prisma.weeklyBasket.findMany({
    where,
    take: parseInt(limit),
    include: {
      items: {
        include: {
          product: {
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
    },
    orderBy: {
      distributionDate: 'desc'
    }
  });

  res.json({
    success: true,
    data: baskets
  });
});

// RÉCUPÉRER UN PANIER HEBDOMADAIRE
const getWeeklyBasketById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const basket = await prisma.weeklyBasket.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: {
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
        },
        orderBy: {
          product: {
            name: 'asc'
          }
        }
      }
    }
  });

  if (!basket) {
    throw new HttpNotFoundError('Panier hebdomadaire introuvable');
  }

  res.json({
    success: true,
    data: basket
  });
});

// RÉCUPÉRER LE PANIER DE LA SEMAINE EN COURS (PUBLIC)
const getCurrentWeeklyBasket = asyncHandler(async (req, res) => {
  const now = new Date();
  
  // Chercher le panier publié le plus récent
  const basket = await prisma.weeklyBasket.findFirst({
    where: {
      isPublished: true,
      distributionDate: {
        gte: now // Distribution future ou aujourd'hui
      }
    },
    include: {
      items: {
        include: {
          product: {
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
        },
        orderBy: {
          product: {
            name: 'asc'
          }
        }
      }
    },
    orderBy: {
      distributionDate: 'asc'
    }
  });

  if (!basket) {
    return res.json({
      success: true,
      message: 'Aucun panier publié pour le moment',
      data: null
    });
  }

  res.json({
    success: true,
    data: basket
  });
});

// CRÉER UN PANIER HEBDOMADAIRE
const createWeeklyBasket = asyncHandler(async (req, res) => {
  const { weekNumber, year, distributionDate, notes, items } = req.body;

  if (!weekNumber || !year || !distributionDate) {
    throw new HttpBadRequestError('Numéro de semaine, année et date de distribution requis');
  }

  // Vérifier qu'un panier n'existe pas déjà pour cette semaine
  const existing = await prisma.weeklyBasket.findUnique({
    where: {
      year_weekNumber: {
        year: parseInt(year),
        weekNumber: parseInt(weekNumber)
      }
    }
  });

  if (existing) {
    throw new HttpConflictError('Un panier existe déjà pour cette semaine');
  }

  // Créer le panier avec ses items
  const basket = await prisma.weeklyBasket.create({
    data: {
      weekNumber: parseInt(weekNumber),
      year: parseInt(year),
      distributionDate: new Date(distributionDate),
      notes,
      items: items && items.length > 0 ? {
        create: items.map(item => ({
          productId: item.productId,
          quantitySmall: parseFloat(item.quantitySmall),
          quantityLarge: parseFloat(item.quantityLarge)
        }))
      } : undefined
    },
    include: {
      items: {
        include: {
          product: {
            include: {
              producer: true
            }
          }
        }
      }
    }
  });

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Panier hebdomadaire créé avec succès',
    data: basket
  });
});

// MODIFIER UN PANIER HEBDOMADAIRE
const updateWeeklyBasket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { distributionDate, notes, items } = req.body;

  const basket = await prisma.weeklyBasket.findUnique({ where: { id } });

  if (!basket) {
    throw new HttpNotFoundError('Panier hebdomadaire introuvable');
  }

  // Si des items sont fournis, supprimer les anciens et créer les nouveaux
  if (items && Array.isArray(items)) {
    // Supprimer tous les items existants
    await prisma.weeklyBasketItem.deleteMany({
      where: { weeklyBasketId: id }
    });

    // Créer les nouveaux items
    if (items.length > 0) {
      await prisma.weeklyBasketItem.createMany({
        data: items.map(item => ({
          weeklyBasketId: id,
          productId: item.productId,
          quantitySmall: parseFloat(item.quantitySmall),
          quantityLarge: parseFloat(item.quantityLarge)
        }))
      });
    }
  }

  const updated = await prisma.weeklyBasket.update({
    where: { id },
    data: {
      ...(distributionDate && { distributionDate: new Date(distributionDate) }),
      notes
    },
    include: {
      items: {
        include: {
          product: {
            include: {
              producer: true
            }
          }
        }
      }
    }
  });

  res.json({
    success: true,
    message: 'Panier hebdomadaire modifié avec succès',
    data: updated
  });
});

// SUPPRIMER UN PANIER HEBDOMADAIRE
const deleteWeeklyBasket = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const basket = await prisma.weeklyBasket.findUnique({
    where: { id },
    include: { pickups: true }
  });

  if (!basket) {
    throw new HttpNotFoundError('Panier hebdomadaire introuvable');
  }

  if (basket.pickups.length > 0) {
    throw new HttpConflictError(
      'Impossible de supprimer ce panier car des retraits sont associés'
    );
  }

  await prisma.weeklyBasket.delete({ where: { id } });

  res.json({
    success: true,
    message: 'Panier hebdomadaire supprimé avec succès'
  });
});

// PUBLIER UN PANIER HEBDOMADAIRE
const publishWeeklyBasket = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const basket = await prisma.weeklyBasket.findUnique({
    where: { id },
    include: { items: true }
  });

  if (!basket) {
    throw new HttpNotFoundError('Panier hebdomadaire introuvable');
  }

  if (basket.items.length === 0) {
    throw new HttpBadRequestError('Le panier doit contenir au moins un produit');
  }

  const published = await prisma.weeklyBasket.update({
    where: { id },
    data: {
      isPublished: true,
      publishedAt: new Date()
    },
    include: {
      items: {
        include: {
          product: true
        }
      }
    }
  });

  // TODO: Envoyer newsletter aux abonnés actifs

  res.json({
    success: true,
    message: 'Panier hebdomadaire publié avec succès',
    data: published
  });
});

// DUPLIQUER UN PANIER HEBDOMADAIRE
const duplicateWeeklyBasket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { weekNumber, year, distributionDate } = req.body;

  if (!weekNumber || !year || !distributionDate) {
    throw new HttpBadRequestError('Numéro de semaine, année et date requis');
  }

  const original = await prisma.weeklyBasket.findUnique({
    where: { id },
    include: { items: true }
  });

  if (!original) {
    throw new HttpNotFoundError('Panier introuvable');
  }

  // Vérifier qu'un panier n'existe pas déjà
  const existing = await prisma.weeklyBasket.findUnique({
    where: {
      year_weekNumber: {
        year: parseInt(year),
        weekNumber: parseInt(weekNumber)
      }
    }
  });

  if (existing) {
    throw new HttpConflictError('Un panier existe déjà pour cette semaine');
  }

  // Créer le nouveau panier avec les mêmes produits
  const duplicated = await prisma.weeklyBasket.create({
    data: {
      weekNumber: parseInt(weekNumber),
      year: parseInt(year),
      distributionDate: new Date(distributionDate),
      notes: original.notes,
      items: {
        create: original.items.map(item => ({
          productId: item.productId,
          quantitySmall: item.quantitySmall,
          quantityLarge: item.quantityLarge
        }))
      }
    },
    include: {
      items: {
        include: {
          product: true
        }
      }
    }
  });

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Panier dupliqué avec succès',
    data: duplicated
  });
});

// AJOUTER UN PRODUIT AU PANIER
const addProductToBasket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { productId, quantitySmall, quantityLarge } = req.body;

  if (!productId || !quantitySmall || !quantityLarge) {
    throw new HttpBadRequestError('Produit et quantités requis');
  }

  const basket = await prisma.weeklyBasket.findUnique({ where: { id } });

  if (!basket) {
    throw new HttpNotFoundError('Panier introuvable');
  }

  // Vérifier que le produit existe
  const product = await prisma.product.findUnique({ where: { id: productId } });

  if (!product) {
    throw new HttpNotFoundError('Produit introuvable');
  }

  // Vérifier que le produit n'est pas déjà dans le panier
  const existing = await prisma.weeklyBasketItem.findUnique({
    where: {
      weeklyBasketId_productId: {
        weeklyBasketId: id,
        productId
      }
    }
  });

  if (existing) {
    throw new HttpConflictError('Ce produit est déjà dans le panier');
  }

  const item = await prisma.weeklyBasketItem.create({
    data: {
      weeklyBasketId: id,
      productId,
      quantitySmall: parseFloat(quantitySmall),
      quantityLarge: parseFloat(quantityLarge)
    },
    include: {
      product: {
        include: {
          producer: true
        }
      }
    }
  });

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Produit ajouté au panier',
    data: item
  });
});

// MODIFIER UN PRODUIT DU PANIER
const updateBasketProduct = asyncHandler(async (req, res) => {
  const { id, productId } = req.params;
  const { quantitySmall, quantityLarge } = req.body;

  const item = await prisma.weeklyBasketItem.findUnique({
    where: {
      weeklyBasketId_productId: {
        weeklyBasketId: id,
        productId
      }
    }
  });

  if (!item) {
    throw new HttpNotFoundError('Produit introuvable dans ce panier');
  }

  const updated = await prisma.weeklyBasketItem.update({
    where: { id: item.id },
    data: {
      quantitySmall: parseFloat(quantitySmall),
      quantityLarge: parseFloat(quantityLarge)
    },
    include: {
      product: true
    }
  });

  res.json({
    success: true,
    message: 'Quantités mises à jour',
    data: updated
  });
});

// RETIRER UN PRODUIT DU PANIER
const removeProductFromBasket = asyncHandler(async (req, res) => {
  const { id, productId } = req.params;

  const item = await prisma.weeklyBasketItem.findUnique({
    where: {
      weeklyBasketId_productId: {
        weeklyBasketId: id,
        productId
      }
    }
  });

  if (!item) {
    throw new HttpNotFoundError('Produit introuvable dans ce panier');
  }

  await prisma.weeklyBasketItem.delete({ where: { id: item.id } });

  res.json({
    success: true,
    message: 'Produit retiré du panier'
  });
});

export {
  getAllWeeklyBaskets,
  getWeeklyBasketById,
  getCurrentWeeklyBasket,
  createWeeklyBasket,
  updateWeeklyBasket,
  deleteWeeklyBasket,
  publishWeeklyBasket,
  duplicateWeeklyBasket,
  addProductToBasket,
  updateBasketProduct,
  removeProductFromBasket
};