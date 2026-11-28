/* Un compte connecté demande l'accès à l'espace producteur. La demande ne porte
   que la ferme revendiquée ; chaque dépôt, accepté ou refusé, laisse une ligne
   au journal. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';
import { formatDateFR } from '../../src/services/closure.service.js';

const { base, journal, verrous } = vi.hoisted(() => ({
  base: { comptes: [], demandes: [], panne: null },
  journal: [],
  verrous: [],
}));

vi.mock('../../src/services/audit.service.js', () => ({
  logAudit: async (_req, action, severite, cible, details, code) => {
    journal.push({ action, severite, cible, details, code });
  },
}));

const correspond = (ligne, where) => Object.entries(where).every(([cle, attendu]) => {
  if (cle === 'OR') return attendu.some((clause) => correspond(ligne, clause));
  if (attendu && typeof attendu === 'object' && 'gt' in attendu) return ligne[cle] != null && ligne[cle] > attendu.gt;
  return ligne[cle] === attendu;
});

// Aucune table Producer ici : une lecture de fiche ferait échouer le dépôt.
vi.mock('../../src/config/database.js', () => {
  const prisma = {
    $transaction: async (travail) => {
      if (base.panne) throw base.panne;
      return travail(prisma);
    },
    $queryRaw: async (morceaux, ...valeurs) => {
      verrous.push({ sql: morceaux.join('?'), valeurs });
      return [];
    },
    user: {
      findUnique: async ({ where }) => {
        const compte = base.comptes.find((c) => c.id === where.id);
        return compte ? { ...compte } : null;
      },
    },
    producerAccessRequest: {
      findFirst: async ({ where }) => base.demandes.find((d) => correspond(d, where)) ?? null,
      findMany: async ({ where }) => base.demandes.filter((d) => correspond(d, where)),
      create: async ({ data }) => {
        const demande = { id: `demande-${base.demandes.length + 1}`, status: 'PENDING', ...data };
        base.demandes.push(demande);
        return { id: demande.id, farmClaim: demande.farmClaim };
      },
    },
  };

  return { prisma };
});

const { submitAccessRequest } = await import('../../src/controllers/producer-access-requests.controller.js');

const JOUR = 24 * 60 * 60 * 1000;
const ilYa = (jours) => new Date(Date.now() - jours * JOUR);
const plusTrente = (date) => new Date(date.getTime() + 30 * JOUR);

const membre = { id: 'user-0001', role: 'MEMBER', emailVerified: true, producerId: null };

const deposer = (body = { farmClaim: 'La Ferme des Lilas' }, compte = membre) => appeler(submitAccessRequest, {
  body,
  user: { id: compte.id, email: 'camille@example.org', role: compte.role },
  ip: '203.0.113.10',
});

const echec = (motif, id = membre.id) => ({
  action: 'FAILED_PRODUCER_ACCESS_REQUEST',
  severite: 'IMPORTANT',
  cible: { type: 'USER', id },
  details: { motif },
  code: motif,
});

beforeEach(() => {
  base.comptes = [{ ...membre }];
  base.demandes = [];
  base.panne = null;
  journal.length = 0;
  verrous.length = 0;
});

describe('Dépôt d\'une demande d\'accès producteur', () => {
  it('enregistre la demande d\'un adhérent vérifié, sous verrou, et la consigne', async () => {
    const { statut, corps } = await deposer();

    expect(statut).toBe(201);
    expect(corps).toEqual({ success: true, message: 'Votre demande a bien été reçue. Un administrateur la vérifiera.' });
    expect(base.demandes).toEqual([{ id: 'demande-1', status: 'PENDING', userId: membre.id, farmClaim: 'La Ferme des Lilas' }]);
    expect(verrous).toEqual([{ sql: expect.stringContaining('FOR UPDATE'), valeurs: [membre.id] }]);
    expect(journal).toEqual([{
      action: 'CREATE_PRODUCER_ACCESS_REQUEST',
      severite: 'IMPORTANT',
      cible: { type: 'PRODUCER_ACCESS_REQUEST', id: 'demande-1', label: 'La Ferme des Lilas' },
      details: undefined,
      code: undefined,
    }]);
  });

  it('ne garde du corps que la ferme revendiquée', async () => {
    await deposer({
      farmClaim: 'La Ferme des Lilas',
      firstName: 'Camille',
      email: 'camille@example.org',
      producerId: 'ferme-0001',
      status: 'APPROVED',
    });

    expect(base.demandes).toEqual([{ id: 'demande-1', status: 'PENDING', userId: membre.id, farmClaim: 'La Ferme des Lilas' }]);
  });

  it('répond pareil quelle que soit la ferme nommée', async () => {
    const autre = { ...membre, id: 'user-0002' };
    base.comptes.push(autre);

    const connue = await deposer({ farmClaim: 'La Ferme des Lilas' });
    const inventee = await deposer({ farmClaim: 'Une ferme qui n\'existe pas' }, autre);

    expect(connue.statut).toBe(201);
    expect(inventee.statut).toBe(201);
    expect(inventee.corps).toEqual(connue.corps);
  });

  it.each([
    ['email non vérifié', { emailVerified: false }, 403, 'EMAIL_NON_VERIFIE'],
    ['administrateur', { role: 'ADMIN' }, 403, 'COMPTE_ADMIN'],
    ['déjà producteur', { role: 'PRODUCER', producerId: 'ferme-0001' }, 409, 'DEJA_RATTACHE'],
    ['rattaché sans le rôle', { producerId: 'ferme-0001' }, 409, 'DEJA_RATTACHE'],
  ])('refuse un compte %s, et le consigne', async (_cas, etat, statutAttendu, motif) => {
    base.comptes = [{ ...membre, ...etat }];

    const { statut } = await deposer(undefined, base.comptes[0]);

    expect(statut).toBe(statutAttendu);
    expect(base.demandes).toHaveLength(0);
    expect(journal).toEqual([echec(motif)]);
  });

  it('refuse une seconde demande tant que la première attend', async () => {
    base.demandes = [{ id: 'demande-0', userId: membre.id, status: 'PENDING', farmClaim: 'La Ferme des Lilas' }];

    const { statut, message } = await deposer();

    expect(statut).toBe(409);
    expect(message).toBe('Vous avez déjà une demande en attente.');
    expect(base.demandes).toHaveLength(1);
    expect(journal).toEqual([echec('DEMANDE_EN_ATTENTE')]);
  });

  it('attend trente jours après un refus', async () => {
    const refus = ilYa(10);
    base.demandes = [{ id: 'demande-0', userId: membre.id, status: 'REJECTED', processedAt: refus }];

    const { statut, message } = await deposer();

    expect(statut).toBe(409);
    expect(message).toBe(`Votre dernière demande a été refusée. Vous pourrez en déposer une nouvelle à partir du ${formatDateFR(plusTrente(refus))}.`);
    expect(journal).toEqual([echec('REFUS_RECENT')]);

    base.demandes[0].processedAt = ilYa(31);
    expect((await deposer()).statut).toBe(201);
  });

  it('attend trente jours après une révocation', async () => {
    const revocation = ilYa(5);
    base.demandes = [{ id: 'demande-0', userId: membre.id, status: 'REVOKED', processedAt: ilYa(200), revokedAt: revocation }];

    const { statut, message } = await deposer();

    expect(statut).toBe(409);
    expect(message).toBe(`Votre accès producteur a été retiré. Vous pourrez déposer une nouvelle demande à partir du ${formatDateFR(plusTrente(revocation))}.`);
    expect(journal).toEqual([echec('REVOCATION_RECENTE')]);

    base.demandes[0].revokedAt = ilYa(31);
    expect((await deposer()).statut).toBe(201);
  });

  it('compte le délai depuis la fermeture la plus récente', async () => {
    const revocation = ilYa(2);
    base.demandes = [
      { id: 'demande-0', userId: membre.id, status: 'REJECTED', processedAt: ilYa(20) },
      { id: 'demande-1', userId: membre.id, status: 'REVOKED', processedAt: ilYa(15), revokedAt: revocation },
    ];

    const { message } = await deposer();

    expect(message).toContain(formatDateFR(plusTrente(revocation)));
  });

  it.each([
    ['vide', {}],
    ['blanc', { farmClaim: '   ' }],
    ['trop long', { farmClaim: 'x'.repeat(501) }],
    ['qui n\'est pas un texte', { farmClaim: 42 }],
  ])('refuse un corps %s sans ouvrir de transaction', async (_cas, body) => {
    const { statut } = await deposer(body);

    expect(statut).toBe(400);
    expect(verrous).toHaveLength(0);
    expect(base.demandes).toHaveLength(0);
    expect(journal).toEqual([echec('VALIDATION')]);
  });

  it('consigne une panne de base et la laisse remonter', async () => {
    base.panne = new Error('connexion perdue');

    const { erreur } = await deposer();

    expect(erreur.message).toBe('connexion perdue');
    expect(base.demandes).toHaveLength(0);
    expect(journal).toEqual([echec('ERREUR_TECHNIQUE')]);
  });
});
