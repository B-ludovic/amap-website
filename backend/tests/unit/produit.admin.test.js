/* La modification d'un produit par l'admin : sous verrou, sans réactiver un
   produit dont le producteur a demandé la suppression, sans doublon dans le
   catalogue d'une ferme, avec une catégorie connue de la base. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';

const { base, verrous } = vi.hoisted(() => ({
  base: { fiches: [], produits: [], appels: [] },
  verrous: [],
}));

vi.mock('../../src/services/audit.service.js', () => ({ logAudit: async () => {} }));
vi.mock('../../src/services/email.service.js', () => ({ default: {} }));

const produitDe = (id) => base.produits.find((p) => p.id === id);

vi.mock('../../src/config/database.js', () => {
  const prisma = {
    $transaction: async (travail) => travail(prisma),
    $queryRaw: async (morceaux, ...valeurs) => {
      verrous.push({ table: morceaux.join('?').match(/FROM "(\w+)"/)[1], id: valeurs[0] });
      return [];
    },
    producer: {
      findUnique: async ({ where }) => base.fiches.find((f) => f.id === where.id) ?? null,
    },
    product: {
      findUnique: async ({ where }) => (produitDe(where.id) ? { ...produitDe(where.id) } : null),
      findFirst: async ({ where }) => base.produits.find((p) => p.name === where.name
        && p.producerId === where.producerId
        && p.id !== where.id?.not) ?? null,
      update: async ({ where, data }) => {
        base.appels.push('product.update');
        const champs = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
        return { ...Object.assign(produitDe(where.id), champs) };
      },
    },
  };

  return { prisma };
});

const { updateProduct } = await import('../../src/controllers/admin.controller.js');

const admin = { id: 'admin-0001', email: 'claire@example.org', role: 'ADMIN' };
const modifier = (id, body) => appeler(updateProduct, { params: { id }, body, user: admin });

beforeEach(() => {
  base.fiches = [{ id: 'ferme-0001', name: 'La Ferme des Lilas' }, { id: 'ferme-0002', name: 'Le Verger du Coteau' }];
  base.produits = [
    { id: 'produit-a', name: 'Carottes', producerId: 'ferme-0001', isActive: true, isExample: false, deletionRequestedAt: null },
    { id: 'produit-b', name: 'Poireaux', producerId: 'ferme-0001', isActive: true, isExample: false, deletionRequestedAt: null },
    { id: 'produit-c', name: 'Carottes', producerId: 'ferme-0002', isActive: true, isExample: false, deletionRequestedAt: null },
  ];
  base.appels = [];
  verrous.length = 0;
});

describe('Modification d\'un produit par l\'admin', () => {
  it('écrit sous le verrou de la ligne', async () => {
    const { statut } = await modifier('produit-a', { description: 'Variété nantaise' });

    expect(statut).toBe(200);
    expect(verrous).toEqual([{ table: 'Product', id: 'produit-a' }]);
  });

  it('refuse de réactiver un produit dont la suppression est demandée', async () => {
    Object.assign(produitDe('produit-a'), { isActive: false, deletionRequestedAt: new Date('2026-11-01') });
    const { statut } = await modifier('produit-a', { isActive: true });

    expect(statut).toBe(409);
    expect(produitDe('produit-a').isActive).toBe(false);
    expect(base.appels).toHaveLength(0);
  });

  it('laisse modifier le reste pendant la demande, case décochée comme l\'envoie le formulaire', async () => {
    Object.assign(produitDe('produit-a'), { isActive: false, deletionRequestedAt: new Date('2026-11-01') });
    const { statut } = await modifier('produit-a', { description: 'Fin de saison', isActive: false });

    expect(statut).toBe(200);
    expect(produitDe('produit-a')).toMatchObject({ description: 'Fin de saison', deletionRequestedAt: new Date('2026-11-01') });
  });

  it('refuse un renommage en doublon dans la même ferme', async () => {
    const { statut } = await modifier('produit-b', { name: 'carottes' });

    expect(statut).toBe(400);
    expect(produitDe('produit-b').name).toBe('Poireaux');
  });

  it('refuse un changement de ferme vers une ferme qui a déjà ce nom', async () => {
    const { statut } = await modifier('produit-a', { producerId: 'ferme-0002' });

    expect(statut).toBe(400);
    expect(produitDe('produit-a').producerId).toBe('ferme-0001');
  });

  it('accepte le formulaire renvoyé avec le nom inchangé', async () => {
    const { statut } = await modifier('produit-a', { name: 'Carottes', producerId: 'ferme-0001', isActive: true });

    expect(statut).toBe(200);
  });

  it('refuse une catégorie inconnue de la base avant toute écriture', async () => {
    const { statut, message } = await modifier('produit-a', { category: 'HONEY' });

    expect(statut).toBe(400);
    expect(message).toBe('Catégorie invalide');
    expect(verrous).toHaveLength(0);
  });

  it('répond introuvable pour un produit qui n\'existe pas', async () => {
    const { statut } = await modifier('produit-z', { description: 'Rien' });

    expect(statut).toBe(404);
  });
});
