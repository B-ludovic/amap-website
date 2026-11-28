/* La porte de l'espace producteur : le rôle et le rattachement ensemble, sinon
   un refus journalisé. La ferme posée sur la requête vient du compte, jamais de
   ce que le client envoie. */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { journal } = vi.hoisted(() => ({ journal: [] }));

vi.mock('../../src/services/audit.service.js', () => ({
  logAudit: async (_req, action, severite, cible, details, code) => {
    journal.push({ action, severite, cible, details, code });
  },
}));

const { producerOnly } = await import('../../src/middlewares/role.middleware.js');

// producerOnly passe par asyncHandler : on attend la sortie par next, avec ou sans erreur.
const franchir = (req) => new Promise((resolve) => {
  producerOnly(req, {}, (erreur) => resolve({ erreur, req }));
});

const requete = (user, extra = {}) => ({
  user,
  method: 'PUT',
  originalUrl: '/api/producer/products/produit-9?x=1',
  body: { producerId: 'ferme-pirate' },
  params: { producerId: 'ferme-pirate' },
  ...extra,
});

const producteur = { id: 'user-0001', role: 'PRODUCER', producerId: 'ferme-0001' };

beforeEach(() => {
  journal.length = 0;
});

describe('Porte de l\'espace producteur', () => {
  it('laisse passer un producteur rattaché et pose sa ferme sur la requête', async () => {
    const { erreur, req } = await franchir(requete(producteur));

    expect(erreur).toBeUndefined();
    expect(req.producerId).toBe('ferme-0001');
    expect(journal).toHaveLength(0);
  });

  it('ignore la ferme envoyée par le client', async () => {
    const { req } = await franchir(requete(producteur));

    expect(req.producerId).toBe('ferme-0001');
    expect(req.producerId).not.toBe(req.body.producerId);
  });

  it.each([
    ['un adhérent', { id: 'user-0002', role: 'MEMBER', producerId: null }, 'ROLE_NON_PRODUCTEUR'],
    ['un administrateur', { id: 'user-0003', role: 'ADMIN', producerId: null }, 'ROLE_NON_PRODUCTEUR'],
    ['un rattachement sans le rôle', { id: 'user-0004', role: 'MEMBER', producerId: 'ferme-0001' }, 'ROLE_NON_PRODUCTEUR'],
    ['le rôle sans rattachement', { id: 'user-0005', role: 'PRODUCER', producerId: null }, 'SANS_RATTACHEMENT'],
  ])('refuse %s, et le consigne', async (_cas, user, motif) => {
    const { erreur, req } = await franchir(requete(user));

    expect(erreur.statusCode).toBe(403);
    expect(req.producerId).toBeUndefined();
    expect(journal).toEqual([{
      action: 'FAILED_PRODUCER_SCOPE_CHECK',
      severite: 'CRITICAL',
      cible: { type: 'USER', id: user.id },
      details: { motif, method: 'PUT', path: '/api/producer/products/produit-9' },
      code: motif,
    }]);
  });

  it('refuse une requête sans session', async () => {
    const { erreur } = await franchir(requete(undefined));

    expect(erreur.statusCode).toBe(403);
    expect(journal).toHaveLength(0);
  });
});
