import {
  generateWeeklyBasket,
  getActiveSeason,
  getIsoWeekParts
} from '../services/weeklyBasketGenerator.service.js';

const DISTRIBUTION_DAY = 3;
const GENERATION_DAY = 4;
const GENERATION_HOUR = 2;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const PARIS_TIME_ZONE = 'Europe/Paris';
const WEEKDAY_NUMBERS = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

function getParisDateParts(now) {
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: PARIS_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    hourCycle: 'h23',
    weekday: 'short'
  }).formatToParts(now);

  const values = Object.fromEntries(
    dateParts
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value])
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    weekday: WEEKDAY_NUMBERS[values.weekday]
  };
}

export function getNextDistributionDate(now = new Date()) {
  const { year, month, day, weekday } = getParisDateParts(now);
  const targetDate = new Date(Date.UTC(year, month - 1, day, 12));
  const daysUntilDistribution = (DISTRIBUTION_DAY - weekday + 7) % 7 || 7;

  targetDate.setUTCDate(targetDate.getUTCDate() + daysUntilDistribution);
  return targetDate;
}

export async function generateNextWeeklyBasket(now = new Date()) {
  const { weekday, hour } = getParisDateParts(now);
  if (weekday !== GENERATION_DAY || hour < GENERATION_HOUR) {
    return null;
  }

  const distributionDate = getNextDistributionDate(now);
  const season = await getActiveSeason(distributionDate);
  const basket = await generateWeeklyBasket({ distributionDate, season });
  const { year, weekNumber } = getIsoWeekParts(distributionDate);

  console.log(`[WeeklyBasketJob] Panier semaine ${weekNumber}/${year} prêt pour publication`);
  return basket;
}

export function startWeeklyBasketGenerationJob() {
  generateNextWeeklyBasket().catch(error => {
    console.error('[WeeklyBasketJob] Erreur de génération:', error);
  });

  setInterval(() => {
    generateNextWeeklyBasket().catch(error => {
      console.error('[WeeklyBasketJob] Erreur de génération:', error);
    });
  }, CHECK_INTERVAL_MS);

  console.log('[WeeklyBasketJob] Job démarré (jeudi après 02:00)');
}