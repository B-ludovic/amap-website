/* La page publique des producteurs ne montre que les produits actifs et non
   retirés : un produit décoché ou en attente de suppression n'y figure plus. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';

const { base } = vi.hoisted(() => ({ base: { fiches: [], produits: [] } }));

const correspond = (ligne, where = {}) => Object.entries(where).every(([cle, valeur]) => ligne[cle] === valeur);

const avecProduits = (fiche, select) => ({
  ...fiche,
  products: base.produits.filter((p) => p.producerId === fiche.id && correspond(p, select.products.where)),
});

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    producer: {
      findMany: async ({ where, select }) => base.fiches.filter((f) => correspond(f, where)).map((f) => avecProduits(f, select)),
      findUnique: async ({ where, select }) => {
        const fiche = base.fiches.find((f) => f.id === where.id);
        return fiche ? avecProduits(fiche, select) : null;
      },
    },
  },
}));

const { getAllProducers, getProducerById } = await import('../../src/controllers/producers.controller.js');

beforeEach(() => {
  base.fiches = [{ id: 'ferme-0001', name: 'La Ferme des Lilas', isActive: true }];
  base.produits = [
    { id: 'actif', producerId: 'ferme-0001', isActive: true, deletedAt: null, deletionRequestedAt: null },
    { id: 'decoche', producerId: 'ferme-0001', isActive: false, deletedAt: null, deletionRequestedAt: null },
    { id: 'suppression-demandee', producerId: 'ferme-0001', isActive: false, deletedAt: null, deletionRequestedAt: new Date('2026-11-01') },
    { id: 'retire', producerId: 'ferme-0001', isActive: true, deletedAt: new Date('2026-01-01'), deletionRequestedAt: null },
  ];
});

describe('Produits affichés sur la page publique des producteurs', () => {
  it('liste des fermes : les seuls produits actifs et non retirés', async () => {
    const { corps } = await appeler(getAllProducers, {});

    expect(corps.data.producers[0].products.map((p) => p.id)).toEqual(['actif']);
  });

  it('fiche d\'une ferme : les seuls produits actifs et non retirés', async () => {
    const { corps } = await appeler(getProducerById, { params: { id: 'ferme-0001' } });

    expect(corps.data.producer.products.map((p) => p.id)).toEqual(['actif']);
  });
});
