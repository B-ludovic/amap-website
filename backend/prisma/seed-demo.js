/* Jeu de démonstration : producteurs, produits et panier de la semaine.

   Tout ce qui est créé ici porte isExample: true, ce qui le rend supprimable
   d'un seul geste depuis l'administration (Paramètres → Exemples), sans toucher
   aux données réelles saisies à côté.

   Aucune suppression, aucune écrasure : le script vérifie l'existence avant
   chaque création et peut être relancé sans produire de doublon. À l'inverse de
   prisma/seed.js, il ne doit donc jamais vider quoi que ce soit. */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const PRODUCERS = [
  {
    email: 'exemple-maraichage@auxptitspois.test',
    name: 'Ferme des Trois Chênes',
    phone: '0169284412',
    specialty: 'Maraîchage diversifié',
    description:
      "Vingt ans de maraîchage sur le plateau de Saclay. La ferme cultive une soixantaine de variétés en plein champ et sous serres froides, sans chauffage ni traitement de synthèse.",
    city: 'Saclay',
    postalCode: '91400',
    distanceKm: 18,
    certification: 'ORGANIC',
    farmDetailLabel: 'Surface',
    farmDetail: '4 hectares · 2 serres froides',
    partnerSince: 2019,
    products: [
      { name: 'Tomate ancienne', category: 'VEGETABLES', seasons: ['SUMMER'] },
      { name: 'Courgette', category: 'VEGETABLES', seasons: ['SUMMER'] },
      { name: 'Aubergine', category: 'VEGETABLES', seasons: ['SUMMER'] },
      { name: 'Poivron', category: 'VEGETABLES', seasons: ['SUMMER'] },
      { name: 'Concombre', category: 'VEGETABLES', seasons: ['SPRING', 'SUMMER'] },
      { name: 'Haricot vert', category: 'VEGETABLES', seasons: ['SUMMER'] },
      { name: 'Salade batavia', category: 'VEGETABLES', seasons: ['SPRING', 'SUMMER', 'AUTUMN'] },
      { name: 'Carotte', category: 'VEGETABLES', seasons: ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'] },
      { name: 'Poireau', category: 'VEGETABLES', seasons: ['AUTUMN', 'WINTER'] },
      { name: 'Pomme de terre', category: 'VEGETABLES', seasons: ['SUMMER', 'AUTUMN', 'WINTER'] },
      { name: 'Épinard', category: 'VEGETABLES', seasons: ['SPRING', 'AUTUMN'] },
      { name: 'Potiron', category: 'VEGETABLES', seasons: ['AUTUMN', 'WINTER'] },
    ],
  },
  {
    email: 'exemple-verger@auxptitspois.test',
    name: 'Le Verger de Vauhallan',
    phone: '0160191877',
    specialty: 'Arboriculture',
    description:
      "Un verger conduit en agriculture biologique depuis 2011 : pommes, poires et fruits rouges de saison, cueillis à maturité la veille de la distribution.",
    city: 'Vauhallan',
    postalCode: '91430',
    distanceKm: 14,
    certification: 'ORGANIC',
    farmDetailLabel: 'Verger',
    farmDetail: '3 hectares · 12 variétés de pommes',
    partnerSince: 2021,
    products: [
      { name: 'Pomme', category: 'FRUITS', seasons: ['AUTUMN', 'WINTER'] },
      { name: 'Poire', category: 'FRUITS', seasons: ['AUTUMN'] },
      { name: 'Fraise', category: 'FRUITS', seasons: ['SPRING', 'SUMMER'] },
      { name: 'Framboise', category: 'FRUITS', seasons: ['SUMMER'] },
      { name: 'Prune', category: 'FRUITS', seasons: ['SUMMER'] },
    ],
  },
  {
    email: 'exemple-volailles@auxptitspois.test',
    name: 'Les Poules de Châteaufort',
    phone: '0130521963',
    specialty: 'Œufs de plein air',
    description:
      "Trois cents poules élevées en plein air sur un parcours arboré. Les œufs sont ramassés le matin même de la distribution.",
    city: 'Châteaufort',
    postalCode: '78117',
    distanceKm: 22,
    certification: 'CONVERSION',
    farmDetailLabel: 'Cheptel',
    farmDetail: '300 poules · parcours de 2 hectares',
    partnerSince: 2023,
    products: [{ name: 'Œufs (boîte de 6)', category: 'EGGS', seasons: ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'] }],
  },
  {
    email: 'exemple-moulin@auxptitspois.test',
    name: 'Moulin de Gometz',
    phone: '0164950238',
    specialty: 'Farines et légumes secs',
    description:
      "Meunerie familiale à la meule de pierre. Blés et lentilles cultivés dans un rayon de dix kilomètres autour du moulin.",
    city: 'Gometz-la-Ville',
    postalCode: '91400',
    distanceKm: 28,
    certification: 'ORGANIC',
    farmDetailLabel: 'Production',
    farmDetail: 'Meule de pierre · 40 tonnes par an',
    partnerSince: 2020,
    products: [
      { name: 'Farine de blé T80', category: 'GROCERY', seasons: [] },
      { name: 'Lentilles vertes', category: 'GROCERY', seasons: [] },
      { name: 'Pois chiches', category: 'GROCERY', seasons: [] },
    ],
  },
];

/* Numéro de semaine ISO 8601 : semaines commençant le lundi, la première de
   l'année étant celle qui contient le premier jeudi. C'est la convention que
   suit le modèle WeeklyBasket, dont la clé (year, weekNumber) est unique. */
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

// Le mercredi de la semaine en cours, jour de distribution de l'association.
function nextWednesday(from) {
  const d = new Date(from);
  d.setHours(18, 15, 0, 0);
  d.setDate(d.getDate() + ((3 - d.getDay() + 7) % 7));
  return d;
}

function seasonOf(date) {
  const m = date.getMonth();
  if (m <= 1 || m === 11) return 'WINTER';
  if (m <= 4) return 'SPRING';
  if (m <= 7) return 'SUMMER';
  return 'AUTUMN';
}

async function main() {
  console.log('🌱 Jeu de démonstration (isExample) — aucune suppression\n');

  const created = { producers: 0, products: 0 };
  const seasonalProducts = [];
  const today = new Date();
  const season = seasonOf(today);

  for (const { products, ...fields } of PRODUCERS) {
    const existing = await prisma.producer.findUnique({ where: { email: fields.email } });

    const producer = existing
      ?? (await prisma.producer.create({ data: { ...fields, isExample: true } }));

    console.log(existing ? `⏭️  ${producer.name} — déjà présent` : `✅ ${producer.name}`);
    if (!existing) created.producers += 1;

    for (const product of products) {
      const exists = await prisma.product.findFirst({
        where: { name: product.name, producerId: producer.id },
      });

      const record = exists
        ?? (await prisma.product.create({
          data: {
            ...product,
            producerId: producer.id,
            basketSizes: ['SMALL', 'LARGE'],
            isExample: true,
          },
        }));

      if (!exists) created.products += 1;
      if (product.seasons.length === 0 || product.seasons.includes(season)) {
        seasonalProducts.push(record);
      }
    }
  }

  console.log(`\n   ${created.producers} producteur(s), ${created.products} produit(s) créés.`);

  /* Le panier de la semaine, sans lequel la page d'accueil et /panier-semaine
     n'ont rien à montrer. WeeklyBasket ne porte pas de drapeau isExample : il
     échappe donc à la purge des exemples et se supprime à la main depuis
     l'administration. Sa note le rappelle. */
  const distributionDate = nextWednesday(today);
  const { year, week } = isoWeek(distributionDate);

  const basket = await prisma.weeklyBasket.upsert({
    where: { year_weekNumber: { year, weekNumber: week } },
    update: {},
    create: {
      year,
      weekNumber: week,
      distributionDate,
      season,
      isPublished: true,
      publishedAt: new Date(),
      notes: 'Panier de démonstration — à supprimer avant l\'ouverture au public.',
    },
    include: { items: true },
  });

  if (basket.items.length === 0) {
    const chosen = seasonalProducts.slice(0, 8);
    await prisma.weeklyBasketItem.createMany({
      data: chosen.map((product) => ({
        weeklyBasketId: basket.id,
        productId: product.id,
        basketSizes: ['SMALL', 'LARGE'],
      })),
    });
    console.log(`✅ Panier semaine ${week}/${year} publié — ${chosen.length} produits`);
  } else {
    console.log(`⏭️  Panier semaine ${week}/${year} — déjà garni`);
  }

  console.log('\n🧹 Pour tout retirer : administration → Paramètres → Exemples.');
  console.log('   Le panier hebdomadaire, lui, se supprime depuis Panier hebdomadaire.');
}

main()
  .catch((error) => {
    console.error('❌ Échec du seed de démonstration :', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
