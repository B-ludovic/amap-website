/* Jeu de démonstration : producteurs, produits et panier de la semaine.

   Les produits reprennent les cultures réellement franciliennes, rangées par
   saison : le champ Product.seasons accepte plusieurs valeurs, une carotte
   couvrirait les quatre là où une figue n'en porte qu'une.

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

const TOUTE_ANNEE = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'];

const PRODUCERS = [
  {
    email: 'exemple-maraichage@auxptitspois.test',
    name: 'Ferme des Trois Chênes',
    phone: '0169284412',
    specialty: 'Maraîchage diversifié',
    description:
      "Vingt ans de maraîchage sur le plateau de Saclay. La ferme suit le calendrier francilien sans le forcer : primeurs au printemps, légumes de plein champ l'été, racines et légumes oubliés dès les premiers froids.",
    city: 'Saclay',
    postalCode: '91400',
    distanceKm: 15,
    certification: 'ORGANIC',
    farmDetailLabel: 'Surface',
    farmDetail: '4 hectares · 2 serres froides',
    partnerSince: 2019,
    products: [
      // Printemps — feuilles et primeurs
      { name: 'Roquette', category: 'VEGETABLES', seasons: ['SPRING'] },
      { name: 'Oseille', category: 'VEGETABLES', seasons: ['SPRING'] },
      { name: 'Cerfeuil', category: 'VEGETABLES', seasons: ['SPRING'] },
      { name: 'Ciboule', category: 'VEGETABLES', seasons: ['SPRING'] },
      {
        name: 'Ail frais',
        category: 'VEGETABLES',
        seasons: ['SPRING'],
        description: 'Récolté en vert, avant que la tête ne se divise en gousses sèches.',
      },
      { name: 'Échalote nouvelle', category: 'VEGETABLES', seasons: ['SPRING'] },

      // Été
      { name: 'Pourpier', category: 'VEGETABLES', seasons: ['SUMMER'] },
      { name: 'Poivron corne de bœuf', category: 'VEGETABLES', seasons: ['SUMMER'] },
      {
        name: 'Tétragone',
        category: 'VEGETABLES',
        seasons: ['SUMMER'],
        description: "L'épinard d'été : il tient la chaleur là où l'épinard commun monte en graine.",
      },
      { name: 'Haricot plat', category: 'VEGETABLES', seasons: ['SUMMER'] },
      { name: 'Haricot beurre', category: 'VEGETABLES', seasons: ['SUMMER'] },

      // Automne — racines, oubliés et chicorées
      { name: 'Cerfeuil tubéreux', category: 'VEGETABLES', seasons: ['AUTUMN'] },
      { name: 'Héliantis', category: 'VEGETABLES', seasons: ['AUTUMN'] },
      { name: 'Chou-rave', category: 'VEGETABLES', seasons: ['AUTUMN'] },
      { name: 'Rutabaga', category: 'VEGETABLES', seasons: ['AUTUMN'] },
      { name: 'Scorsonère', category: 'VEGETABLES', seasons: ['AUTUMN'] },
      { name: 'Chicorée frisée', category: 'VEGETABLES', seasons: ['AUTUMN'] },
      { name: 'Scarole', category: 'VEGETABLES', seasons: ['AUTUMN'] },
      {
        name: 'Trévise',
        category: 'VEGETABLES',
        seasons: ['AUTUMN'],
        description: 'La chicorée rouge, amère et ferme, qui supporte la poêle autant que la salade.',
      },

      // Hiver
      {
        name: 'Crosne',
        category: 'VEGETABLES',
        seasons: ['WINTER'],
        description: "Le tubercule qui doit son nom à Crosne, en Essonne, d'où il fut diffusé en 1882.",
      },
      { name: 'Panais rond', category: 'VEGETABLES', seasons: ['WINTER'] },
      {
        name: 'Chou cabus de garde',
        category: 'VEGETABLES',
        seasons: ['WINTER'],
        description: 'Pommé serré, il se conserve en cave jusqu\'au printemps suivant.',
      },
    ],
  },
  {
    email: 'exemple-cressonniere@auxptitspois.test',
    name: 'Cressonnière de Méréville',
    phone: '0164950176',
    specialty: 'Cresson de fontaine et salades forcées',
    description:
      "Des fosses alimentées par des sources qui sortent de terre à douze degrés toute l'année. Méréville est la capitale française du cresson depuis le XIXᵉ siècle, et le forçage en cave y prolonge la saison des salades bien après les gelées.",
    city: 'Méréville',
    postalCode: '91660',
    distanceKm: 55,
    certification: 'ORGANIC',
    farmDetailLabel: 'Installation',
    farmDetail: '14 fosses alimentées à la source · caves de forçage',
    partnerSince: 2022,
    products: [
      {
        name: 'Cresson de fontaine',
        category: 'VEGETABLES',
        seasons: ['SPRING'],
        description: 'La grande spécialité de l\'Essonne, cultivée en fosse dans l\'eau de source.',
      },
      {
        name: 'Pissenlit blanc',
        category: 'VEGETABLES',
        seasons: ['SPRING'],
        description: 'Blanchi par forçage, sans amertume, à manger en salade tiède.',
      },
      {
        name: 'Pissenlit forcé en cave',
        category: 'VEGETABLES',
        seasons: ['WINTER'],
        description: 'Repris en cave obscure au cœur de l\'hiver, quand plus rien ne pousse dehors.',
      },
      {
        name: 'Pourpier d\'hiver',
        category: 'VEGETABLES',
        seasons: ['WINTER'],
        description: 'Aussi appelé claytone de Cuba : une salade charnue qui ne craint pas le gel.',
      },
    ],
  },
  {
    email: 'exemple-verger@auxptitspois.test',
    name: 'Le Verger de Vauhallan',
    phone: '0160191877',
    specialty: 'Fruits et fruits à coque',
    description:
      "Un verger conduit en agriculture biologique depuis 2011, complété d'une châtaigneraie et d'une haie de noisetiers. Les fruits sont cueillis à maturité la veille de la distribution, ce qui exclut les variétés qui voyagent bien mais ne se mangent pas.",
    city: 'Vauhallan',
    postalCode: '91430',
    distanceKm: 12,
    certification: 'ORGANIC',
    farmDetailLabel: 'Verger',
    farmDetail: '3 hectares · châtaigneraie et micro-vergers de pêchers',
    partnerSince: 2021,
    products: [
      { name: 'Groseille à maquereau', category: 'FRUITS', seasons: ['SUMMER'] },
      {
        name: 'Figue',
        category: 'FRUITS',
        seasons: ['SUMMER'],
        description: 'Variétés rustiques du bassin parisien, qui mûrissent sans serre.',
      },
      {
        name: 'Pêche',
        category: 'FRUITS',
        seasons: ['SUMMER'],
        description: 'Issue des micro-vergers de pêchers replantés autour de Vauhallan.',
      },
      {
        name: 'Châtaigne',
        category: 'FRUITS',
        seasons: ['AUTUMN'],
        description: 'Ramassée dans les forêts et vergers franciliens dès la mi-octobre.',
      },
      {
        name: 'Noisette fraîche',
        category: 'FRUITS',
        seasons: ['AUTUMN'],
        description: 'Cueillie encore humide, à consommer dans la quinzaine.',
      },
    ],
  },
  {
    email: 'exemple-simples@auxptitspois.test',
    name: 'Le Jardin des Simples',
    phone: '0169411208',
    specialty: 'Plantes aromatiques et médicinales',
    description:
      "Un jardin de simples cultivé en pleine terre, sans serre chauffée : les plantes y poussent à leur rythme et prennent le goût qu'elles n'ont pas en pot. Les vivaces — thym, sauge, laurier — se récoltent toute l'année.",
    city: 'Bièvres',
    postalCode: '91570',
    distanceKm: 8,
    certification: 'CONVERSION',
    farmDetailLabel: 'Jardin',
    farmDetail: '6 000 m² en pleine terre · 40 espèces',
    partnerSince: 2024,
    products: [
      { name: 'Menthe poivrée', category: 'VEGETABLES', seasons: ['SPRING', 'SUMMER', 'AUTUMN'] },
      { name: 'Estragon', category: 'VEGETABLES', seasons: ['SPRING', 'SUMMER'] },
      { name: 'Mélisse', category: 'VEGETABLES', seasons: ['SPRING', 'SUMMER', 'AUTUMN'] },
      { name: 'Coriandre de pleine terre', category: 'VEGETABLES', seasons: ['SPRING', 'SUMMER'] },
      {
        name: 'Sauge',
        category: 'VEGETABLES',
        seasons: TOUTE_ANNEE,
        description: 'Vivace : la touffe se récolte été comme hiver.',
      },
      { name: 'Thym', category: 'VEGETABLES', seasons: TOUTE_ANNEE },
      { name: 'Laurier-sauce', category: 'VEGETABLES', seasons: TOUTE_ANNEE },
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
    distanceKm: 18,
    certification: 'CONVERSION',
    farmDetailLabel: 'Cheptel',
    farmDetail: '300 poules · parcours de 2 hectares',
    partnerSince: 2023,
    products: [{ name: 'Œufs (boîte de 6)', category: 'EGGS', seasons: TOUTE_ANNEE }],
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
    distanceKm: 22,
    certification: 'ORGANIC',
    farmDetailLabel: 'Production',
    farmDetail: 'Meule de pierre · 40 tonnes par an',
    partnerSince: 2020,
    /* Sans saison : ces produits se conservent et sont proposés toute l'année.
       Ils complètent le panier quand la saison en cours n'offre pas assez. */
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
  const today = new Date();
  const season = seasonOf(today);
  const deSaison = [];
  const toutesSaisons = [];

  for (const { products, ...fields } of PRODUCERS) {
    const existing = await prisma.producer.findUnique({ where: { email: fields.email } });

    const producer = existing
      ?? (await prisma.producer.create({ data: { ...fields, isExample: true } }));

    console.log(existing ? `⏭️  ${producer.name} — déjà présent` : `✅ ${producer.name}`);
    if (!existing) created.producers += 1;

    for (const product of products) {
      const found = await prisma.product.findFirst({
        where: { name: product.name, producerId: producer.id },
      });

      const record = found
        ?? (await prisma.product.create({
          data: {
            ...product,
            producerId: producer.id,
            basketSizes: ['SMALL', 'LARGE'],
            isExample: true,
          },
        }));

      if (!found) created.products += 1;
      if (product.seasons.includes(season)) deSaison.push(record);
      else if (product.seasons.length === 0) toutesSaisons.push(record);
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
    // La saison d'abord ; l'épicerie de garde ne comble que ce qui manque.
    const chosen = [...deSaison, ...toutesSaisons].slice(0, 8);

    await prisma.weeklyBasketItem.createMany({
      data: chosen.map((product) => ({
        weeklyBasketId: basket.id,
        productId: product.id,
        basketSizes: ['SMALL', 'LARGE'],
      })),
    });

    console.log(`✅ Panier semaine ${week}/${year} publié — ${chosen.length} produits`);
    console.log(`   ${chosen.map((p) => p.name).join(', ')}`);
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
