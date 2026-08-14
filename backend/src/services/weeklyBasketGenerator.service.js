import { prisma } from '../config/database.js';

const BASKET_LIMITS = {
  SMALL: 5,
  LARGE: 8
};

const basketInclude = {
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

function shuffleArray(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

export function getIsoWeekParts(date) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNumber);

  const year = utcDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const weekNumber = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);

  return { year, weekNumber };
}

function getSeasonFromDate(date) {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return 'SPRING';
  if (month >= 6 && month <= 8) return 'SUMMER';
  if (month >= 9 && month <= 11) return 'AUTUMN';
  return 'WINTER';
}

export async function getActiveSeason(distributionDate) {
  const activeTheme = await prisma.themeConfig.findFirst({
    where: { isActive: true },
    select: { season: true },
    orderBy: { updatedAt: 'desc' }
  });

  return activeTheme?.season || getSeasonFromDate(distributionDate);
}

function createItemsByBasketSize(products) {
  const selectedProducts = new Map();

  for (const basketSize of Object.keys(BASKET_LIMITS)) {
    const selection = shuffleArray(products.filter(product => product.basketSizes.includes(basketSize)))
      .slice(0, BASKET_LIMITS[basketSize]);

    for (const product of selection) {
      const basketSizes = selectedProducts.get(product.id) || [];
      selectedProducts.set(product.id, [...basketSizes, basketSize]);
    }
  }

  return Array.from(selectedProducts, ([productId, basketSizes]) => ({ productId, basketSizes }));
}

async function resolveExistingBasket(existingBasket, shouldPublish) {
  if (!shouldPublish || existingBasket.isPublished) return existingBasket;

  return prisma.weeklyBasket.update({
    where: { id: existingBasket.id },
    data: {
      isPublished: true,
      publishedAt: existingBasket.publishedAt || new Date()
    },
    include: basketInclude
  });
}

export async function generateWeeklyBasket({ distributionDate, season, notes = null, isPublished = true }) {
  const { year, weekNumber } = getIsoWeekParts(distributionDate);
  const existingBasket = await prisma.weeklyBasket.findUnique({
    where: { year_weekNumber: { year, weekNumber } },
    include: basketInclude
  });

  if (existingBasket) return resolveExistingBasket(existingBasket, isPublished);

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      seasons: { has: season },
      producer: { isActive: true }
    },
    select: { id: true, basketSizes: true }
  });

  const items = createItemsByBasketSize(products);
  if (items.length === 0) {
    throw new Error(`Aucun produit actif n'est éligible pour la saison ${season}`);
  }

  try {
    return await prisma.weeklyBasket.create({
      data: {
        weekNumber,
        year,
        distributionDate,
        season,
        notes,
        isPublished,
        publishedAt: isPublished ? new Date() : null,
        items: { create: items }
      },
      include: basketInclude
    });
  } catch (error) {
    if (error.code !== 'P2002') throw error;

    const concurrentBasket = await prisma.weeklyBasket.findUnique({
      where: { year_weekNumber: { year, weekNumber } },
      include: basketInclude
    });

    return resolveExistingBasket(concurrentBasket, isPublished);
  }
}