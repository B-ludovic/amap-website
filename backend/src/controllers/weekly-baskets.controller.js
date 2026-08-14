import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import emailService from '../services/email.service.js';
import {
  generateWeeklyBasket,
  getActiveSeason
} from '../services/weeklyBasketGenerator.service.js';
import {
  HttpNotFoundError,
  HttpBadRequestError,
  httpStatusCodes
} from '../utils/httpErrors.js';

// Inclusion standard des items avec leur produit éventuel
const itemsInclude = {
  items: {
    include: {
      product: {
        include: {
          producer: {
            select: { id: true, name: true, specialty: true }
          }
        }
      }
    },
    orderBy: { id: 'asc' }
  }
};

const filterItemsByBasketSize = (basket, basketSize) => {
  if (!basketSize) return basket;
  return {
    ...basket,
    items: basket.items.filter(item => item.basketSizes.includes(basketSize))
  };
};

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
    include: itemsInclude,
    orderBy: { distributionDate: 'desc' }
  });

  res.json({ success: true, data: baskets });
});

// RÉCUPÉRER UN PANIER HEBDOMADAIRE
const getWeeklyBasketById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const basket = await prisma.weeklyBasket.findUnique({
    where: { id },
    include: itemsInclude
  });

  if (!basket) {
    throw new HttpNotFoundError('Panier hebdomadaire introuvable');
  }

  res.json({ success: true, data: basket });
});

// RÉCUPÉRER LE PANIER DE LA SEMAINE EN COURS (PUBLIC)
const getCurrentWeeklyBasket = asyncHandler(async (req, res) => {
  const { basketSize } = req.query;
  if (basketSize && !['SMALL', 'LARGE'].includes(basketSize)) {
    throw new HttpBadRequestError('Format de panier invalide');
  }
  const now = new Date();

  const basket = await prisma.weeklyBasket.findFirst({
    where: {
      isPublished: true,
      distributionDate: { gte: now }
    },
    include: itemsInclude,
    orderBy: { distributionDate: 'asc' }
  });

  if (!basket) {
    return res.json({
      success: true,
      message: 'Aucun panier publié pour le moment',
      data: null
    });
  }

  res.json({ success: true, data: filterItemsByBasketSize(basket, basketSize) });
});

// CRÉER UN PANIER HEBDOMADAIRE
const createWeeklyBasket = asyncHandler(async (req, res) => {
  const { distributionDate, notes } = req.body;

  if (!distributionDate) {
    throw new HttpBadRequestError('Date de distribution requise');
  }

  const parsedDistributionDate = new Date(distributionDate);
  if (Number.isNaN(parsedDistributionDate.getTime())) {
    throw new HttpBadRequestError('Date de distribution invalide');
  }

  const season = await getActiveSeason(parsedDistributionDate);
  const basket = await generateWeeklyBasket({
    distributionDate: parsedDistributionDate,
    season,
    notes,
    isPublished: false
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
  const { distributionDate, notes } = req.body;

  const basket = await prisma.weeklyBasket.findUnique({ where: { id } });

  if (!basket) {
    throw new HttpNotFoundError('Panier hebdomadaire introuvable');
  }

  const updated = await prisma.weeklyBasket.update({
    where: { id },
    data: {
      ...(distributionDate && { distributionDate: new Date(distributionDate) }),
      notes
    },
    include: itemsInclude
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

  res.json({ success: true, message: 'Panier hebdomadaire supprimé avec succès' });
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
    data: { isPublished: true, publishedAt: new Date() },
    include: itemsInclude
  });

  // Notifier les abonnés actifs
  const activeSubscribers = await prisma.subscription.findMany({
    where: { status: 'ACTIVE' },
    include: {
      user: { select: { firstName: true, email: true } }
    }
  });
  const recipients = activeSubscribers.map(s => s.user);
  emailService.sendWeeklyBasketNotification(published, recipients);

  res.json({
    success: true,
    message: 'Panier hebdomadaire publié avec succès',
    data: published
  });
});

// DUPLIQUER UN PANIER HEBDOMADAIRE
const duplicateWeeklyBasket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { distributionDate } = req.body;

  if (!distributionDate) {
    throw new HttpBadRequestError('Date de distribution requise');
  }

  const original = await prisma.weeklyBasket.findUnique({ where: { id } });

  if (!original) {
    throw new HttpNotFoundError('Panier introuvable');
  }

  const parsedDistributionDate = new Date(distributionDate);
  if (Number.isNaN(parsedDistributionDate.getTime())) {
    throw new HttpBadRequestError('Date de distribution invalide');
  }

  const season = await getActiveSeason(parsedDistributionDate);
  const duplicated = await generateWeeklyBasket({
    distributionDate: parsedDistributionDate,
    season,
    notes: original.notes,
    isPublished: false
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
  const { productId, customProductName } = req.body;

  if (!productId && !customProductName?.trim()) {
    throw new HttpBadRequestError('productId ou customProductName requis');
  }

  const basket = await prisma.weeklyBasket.findUnique({ where: { id } });

  if (!basket) {
    throw new HttpNotFoundError('Panier introuvable');
  }

  if (productId) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new HttpNotFoundError('Produit introuvable');
    }
  }

  const item = await prisma.weeklyBasketItem.create({
    data: {
      weeklyBasketId: id,
      productId: productId || null,
      customProductName: customProductName?.trim() || null
    },
    include: {
      product: { include: { producer: true } }
    }
  });

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Produit ajouté au panier',
    data: item
  });
});

// MODIFIER UN ITEM DU PANIER (changer le produit ou le nom libre)
const updateBasketProduct = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const { productId, customProductName } = req.body;

  if (!productId && !customProductName?.trim()) {
    throw new HttpBadRequestError('productId ou customProductName requis');
  }

  const item = await prisma.weeklyBasketItem.findFirst({
    where: { id: itemId, weeklyBasketId: id }
  });

  if (!item) {
    throw new HttpNotFoundError('Entrée introuvable dans ce panier');
  }

  const updated = await prisma.weeklyBasketItem.update({
    where: { id: itemId },
    data: {
      productId: productId || null,
      customProductName: customProductName?.trim() || null
    },
    include: {
      product: { include: { producer: true } }
    }
  });

  res.json({ success: true, message: 'Item mis à jour', data: updated });
});

// RETIRER UN PRODUIT DU PANIER
const removeProductFromBasket = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;

  const item = await prisma.weeklyBasketItem.findFirst({
    where: { id: itemId, weeklyBasketId: id }
  });

  if (!item) {
    throw new HttpNotFoundError('Entrée introuvable dans ce panier');
  }

  await prisma.weeklyBasketItem.delete({ where: { id: itemId } });

  res.json({ success: true, message: 'Produit retiré du panier' });
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
