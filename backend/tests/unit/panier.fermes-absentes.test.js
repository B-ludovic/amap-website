/* Ce que le panier propose quand une ferme n'est pas là.

   Le tirage ne piochait que sur trois conditions : produit actif, produit de
   saison, ferme partenaire. Aucune ne sait dire « cette semaine, cette ferme ne
   vient pas » — ses légumes entraient donc dans un panier qu'elle n'apportera
   pas, et la page publique les annonçait sous son nom.

   Le panier reste tiré même s'il maigrit : trois variétés valent mieux qu'une
   page vide. Seul l'étal entièrement vide arrête la génération. */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { etat } = vi.hoisted(() => ({ etat: { produits: [], absences: [], cree: null } }));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    weeklyBasket: {
      findUnique: async () => null,
      create: async ({ data }) => {
        etat.cree = data;
        return { id: 'panier-test', ...data, items: [] };
      }
    },
    producerAbsence: {
      findMany: async ({ where }) => etat.absences.filter(
        absence => absence.startDate <= where.endDate.gte && absence.endDate >= where.startDate.lte
      ).map(absence => ({ producerId: absence.producerId })),
    },
    product: {
      findMany: async ({ where }) => etat.produits
        .filter(produit => produit.isActive)
        .filter(produit => produit.seasons.includes(where.seasons.has))
        .filter(produit => !where.producerId?.notIn?.includes(produit.producerId))
        .map(({ id, basketSizes }) => ({ id, basketSizes })),
    },
  },
}));

const { generateWeeklyBasket } = await import('../../src/services/weeklyBasketGenerator.service.js');

const MERCREDI = new Date(Date.UTC(2026, 7, 19, 12));

function produit(id, producerId) {
  return { id, producerId, isActive: true, seasons: ['SUMMER'], basketSizes: ['SMALL', 'LARGE'] };
}

/* La requête d'absence compare des bornes de jour : on stocke les périodes
   comme le ferait la base, à minuit UTC. */
function absence(producerId, jourDebut, jourFin) {
  return {
    producerId,
    startDate: new Date(Date.UTC(2026, 7, jourDebut)),
    endDate: new Date(Date.UTC(2026, 7, jourFin))
  };
}

function produitsTires() {
  return etat.cree.items.create.map(item => item.productId);
}

beforeEach(() => {
  etat.produits = [
    produit('tomate', 'ferme-loiret'),
    produit('courgette', 'ferme-loiret'),
    produit('oeufs', 'ferme-voisine'),
    produit('miel', 'ferme-voisine'),
  ];
  etat.absences = [];
  etat.cree = null;
});

describe('tirage du panier — fermes absentes', () => {
  it('écarte les produits de la ferme absente ce jour-là', async () => {
    etat.absences = [absence('ferme-loiret', 17, 21)];

    await generateWeeklyBasket({ distributionDate: MERCREDI, season: 'SUMMER' });

    expect(produitsTires().sort()).toEqual(['miel', 'oeufs']);
  });

  it('garde la ferme dont l\'absence est terminée la veille', async () => {
    etat.absences = [absence('ferme-loiret', 10, 18)];

    await generateWeeklyBasket({ distributionDate: MERCREDI, season: 'SUMMER' });

    expect(produitsTires()).toContain('tomate');
  });

  it('écarte la ferme dès le premier jour de son absence', async () => {
    etat.absences = [absence('ferme-loiret', 19, 25)];

    await generateWeeklyBasket({ distributionDate: MERCREDI, season: 'SUMMER' });

    expect(produitsTires()).not.toContain('tomate');
    expect(produitsTires()).not.toContain('courgette');
  });

  it('tire un panier plus maigre plutôt que de renoncer', async () => {
    etat.absences = [absence('ferme-voisine', 17, 21)];

    await generateWeeklyBasket({ distributionDate: MERCREDI, season: 'SUMMER' });

    // Deux variétés au lieu des cinq visées : le panier sort quand même.
    expect(produitsTires()).toHaveLength(2);
  });

  it('renonce seulement quand plus aucune ferme n\'apporte rien', async () => {
    etat.absences = [absence('ferme-loiret', 17, 21), absence('ferme-voisine', 17, 21)];

    await expect(
      generateWeeklyBasket({ distributionDate: MERCREDI, season: 'SUMMER' })
    ).rejects.toThrow(/ferme\(s\) absente\(s\)/);
  });

  it('ne filtre rien quand aucune absence n\'est déclarée', async () => {
    await generateWeeklyBasket({ distributionDate: MERCREDI, season: 'SUMMER' });

    expect(produitsTires()).toHaveLength(4);
  });
});
