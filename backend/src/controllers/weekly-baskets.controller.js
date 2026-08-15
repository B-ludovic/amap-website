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
import { logAudit } from '../services/audit.service.js';

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

  await logAudit(req, 'CREATE_WEEKLY_BASKET', 'IMPORTANT', {
    type: 'WEEKLY_BASKET',
    id: basket.id,
    label: `${basket.year}-S${basket.weekNumber}`
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

  await logAudit(req, 'UPDATE_WEEKLY_BASKET', 'IMPORTANT', {
    type: 'WEEKLY_BASKET',
    id,
    label: `${basket.year}-S${basket.weekNumber}`
  }, { before: { distributionDate: basket.distributionDate }, after: { distributionDate: updated.distributionDate } });

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

  await logAudit(req, 'DELETE_WEEKLY_BASKET', 'IMPORTANT', {
    type: 'WEEKLY_BASKET',
    id,
    label: `${basket.year}-S${basket.weekNumber}`
  });

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

  await logAudit(req, 'PUBLISH_WEEKLY_BASKET', 'IMPORTANT', {
    type: 'WEEKLY_BASKET',
    id,
    label: `${published.year}-S${published.weekNumber}`
  }, { recipientsCount: recipients.length });

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

  await logAudit(req, 'CREATE_WEEKLY_BASKET', 'IMPORTANT', {
    type: 'WEEKLY_BASKET',
    id: duplicated.id,
    label: `${duplicated.year}-S${duplicated.weekNumber}`
  }, { duplicatedFrom: original.id });

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Panier dupliqué avec succès',
    data: duplicated
  });
});

/* Formules auxquelles une entrée appartient. Le tirage automatique les pose
   lui-même ; une correction manuelle doit pouvoir en faire autant, sinon toute
   entrée ajoutée à la main atterrirait dans les deux paniers par défaut. */
const BASKET_SIZES = ['SMALL', 'LARGE'];

const parseBasketSizes = (value) => {
  if (value === undefined) return undefined;

  const sizes = Array.isArray(value) ? value : [value];
  const invalid = sizes.filter(size => !BASKET_SIZES.includes(size));

  if (invalid.length > 0) {
    throw new HttpBadRequestError(`Format de panier invalide : ${invalid.join(', ')}`);
  }
  if (sizes.length === 0) {
    throw new HttpBadRequestError('Sélectionnez au moins un format de panier');
  }

  return sizes;
};

// AJOUTER UN PRODUIT AU PANIER
const addProductToBasket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { productId, customProductName, basketSizes } = req.body;

  if (!productId && !customProductName?.trim()) {
    throw new HttpBadRequestError('productId ou customProductName requis');
  }

  const sizes = parseBasketSizes(basketSizes);

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
      customProductName: customProductName?.trim() || null,
      ...(sizes && { basketSizes: sizes })
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
  const { productId, customProductName, basketSizes } = req.body;

  if (!productId && !customProductName?.trim()) {
    throw new HttpBadRequestError('productId ou customProductName requis');
  }

  const sizes = parseBasketSizes(basketSizes);

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
      customProductName: customProductName?.trim() || null,
      ...(sizes && { basketSizes: sizes })
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
