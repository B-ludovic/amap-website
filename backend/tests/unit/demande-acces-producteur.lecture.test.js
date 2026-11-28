/* Un compte lit sa dernière demande d'accès : son statut, sa ferme déclarée, et
   la date à partir de laquelle il pourra en déposer une nouvelle. Les notes de
   l'admin ne sortent jamais. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';

const { base } = vi.hoisted(() => ({ base: { demandes: [] } }));

const choisir = (ligne, select) => Object.fromEntries(Object.keys(select).map((cle) => [cle, ligne[cle]]));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    producerAccessRequest: {
      findFirst: async ({ where, orderBy, select }) => {
        const [ligne] = base.demandes
          .filter((d) => d.userId === where.userId)
          .sort((a, b) => (orderBy.createdAt === 'desc' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt));
        return ligne ? choisir(ligne, select) : null;
      },
    },
  },
}));

const { getMyAccessRequest } = await import('../../src/controllers/producer-access-requests.controller.js');

const JOUR = 24 * 60 * 60 * 1000;
const ilYa = (jours) => new Date(Date.now() - jours * JOUR);
const compte = { id: 'user-0001', role: 'MEMBER' };
const lire = () => appeler(getMyAccessRequest, { user: compte });

const demande = (champs) => ({
  userId: compte.id,
  farmClaim: 'Les Lilas, à Meaux',
  adminNotes: 'Inconnu au marché',
  processedAt: null,
  revokedAt: null,
  ...champs,
});

beforeEach(() => {
  base.demandes = [];
});

describe('Lecture de sa propre demande d\'accès', () => {
  it('répond sans demande quand le compte n\'en a jamais déposé', async () => {
    base.demandes = [demande({ userId: 'user-0002', status: 'PENDING', createdAt: ilYa(1) })];
    const { statut, corps } = await lire();

    expect(statut).toBe(200);
    expect(corps.data.request).toBeNull();
  });

  it('renvoie la demande en attente, sans les notes de l\'admin', async () => {
    base.demandes = [demande({ status: 'PENDING', createdAt: ilYa(2) })];
    const { corps } = await lire();

    expect(corps.data.request).toEqual({
      status: 'PENDING',
      farmClaim: 'Les Lilas, à Meaux',
      createdAt: expect.any(Date),
      nextRequestAt: null,
    });
    expect(JSON.stringify(corps)).not.toContain('Inconnu au marché');
  });

  it('donne la date de nouvelle demande trente jours après un refus', async () => {
    const processedAt = ilYa(10);
    base.demandes = [demande({ status: 'REJECTED', createdAt: ilYa(12), processedAt })];
    const { corps } = await lire();

    expect(corps.data.request.status).toBe('REJECTED');
    expect(corps.data.request.nextRequestAt).toEqual(new Date(processedAt.getTime() + 30 * JOUR));
  });

  it('donne la date de nouvelle demande trente jours après une révocation', async () => {
    const revokedAt = ilYa(5);
    base.demandes = [demande({ status: 'REVOKED', createdAt: ilYa(90), processedAt: ilYa(88), revokedAt })];
    const { corps } = await lire();

    expect(corps.data.request.nextRequestAt).toEqual(new Date(revokedAt.getTime() + 30 * JOUR));
  });

  it('ne donne plus de date une fois le délai passé', async () => {
    base.demandes = [demande({ status: 'REJECTED', createdAt: ilYa(40), processedAt: ilYa(31) })];
    const { corps } = await lire();

    expect(corps.data.request.nextRequestAt).toBeNull();
  });

  it('lit la plus récente des demandes du compte', async () => {
    base.demandes = [
      demande({ status: 'REJECTED', createdAt: ilYa(80), processedAt: ilYa(78) }),
      demande({ status: 'PENDING', createdAt: ilYa(3), farmClaim: 'Le Verger du Coteau' }),
    ];
    const { corps } = await lire();

    expect(corps.data.request).toMatchObject({ status: 'PENDING', farmClaim: 'Le Verger du Coteau', nextRequestAt: null });
  });
});
