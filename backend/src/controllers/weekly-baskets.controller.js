import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import emailService from '../services/email.service.js';
import {
  HttpNotFoundError,
  HttpBadRequestError,
  HttpConflictError,
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
const getCurrentWeeklyBasket = asyncHandler(async (_req, res) => {
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

  res.json({ success: true, data: basket });
});

// Construit la liste d'items à créer depuis le tableau envoyé par le client
// Chaque item doit avoir soit productId, soit customProductName
const buildItemsCreate = (items) => {
  return items.map(item => {
    if (item.productId) {
      return { productId: item.productId };
    }
    if (item.customProductName?.trim()) {
      return { customProductName: item.customProductName.trim() };
    }
    return null;
  }).filter(Boolean);
};

// CRÉER UN PANIER HEBDOMADAIRE
const createWeeklyBasket = asyncHandler(async (req, res) => {
  const { weekNumber, year, distributionDate, notes, items } = req.body;

  if (!weekNumber || !year || !distributionDate) {
    throw new HttpBadRequestError('Numéro de semaine, année et date de distribution requis');
  }

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

  const itemsData = buildItemsCreate(items || []);

  const basket = await prisma.weeklyBasket.create({
    data: {
      weekNumber: parseInt(weekNumber),
      year: parseInt(year),
      distributionDate: new Date(distributionDate),
      notes,
      items: itemsData.length > 0 ? { create: itemsData } : undefined
    },
    include: itemsInclude
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

  if (items && Array.isArray(items)) {
    await prisma.weeklyBasketItem.deleteMany({ where: { weeklyBasketId: id } });

    const itemsData = buildItemsCreate(items);
    if (itemsData.length > 0) {
      await prisma.weeklyBasketItem.createMany({
        data: itemsData.map(item => ({ weeklyBasketId: id, ...item }))
      });
    }
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

  const duplicated = await prisma.weeklyBasket.create({
    data: {
      weekNumber: parseInt(weekNumber),
      year: parseInt(year),
      distributionDate: new Date(distributionDate),
      notes: original.notes,
      items: {
        create: original.items.map(item => ({
          productId: item.productId || undefined,
          customProductName: item.customProductName || undefined
        }))
      }
    },
    include: itemsInclude
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
