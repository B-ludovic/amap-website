/* L'admin approuve, refuse ou révoque une demande d'accès producteur. Rôle et
   rattachement se posent et se retirent ensemble ; chaque geste, réussi ou
   refusé, laisse sa ligne au journal. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';

const { base, journal, verrous } = vi.hoisted(() => ({
  base: { comptes: [], demandes: [], fiches: [], panne: null },
  journal: [],
  verrous: [],
}));

const BON_MOT_DE_PASSE = 'mot-de-passe-de-la-session';

vi.mock('../../src/services/audit.service.js', () => ({
  logAudit: async (_req, action, severite, cible, details, code) => {
    journal.push({ action, severite, cible, details, code });
  },
}));

vi.mock('../../src/services/reauth.service.js', async () => {
  const { HttpForbiddenError } = await import('../../src/utils/httpErrors.js');
  return {
    confirmPassword: async (_req, password, { refus }) => {
      if (password === BON_MOT_DE_PASSE) return;
      journal.push({ action: 'FAILED_ACCOUNT_REAUTH' });
      throw new HttpForbiddenError(`Mot de passe incorrect : ${refus}`);
    },
  };
});

const compteDe = (id) => base.comptes.find((c) => c.id === id);
const demandeDe = (id) => base.demandes.find((d) => d.id === id);

vi.mock('../../src/config/database.js', () => {
  const prisma = {
    $transaction: async (travail) => {
      if (base.panne) throw base.panne;
      return travail(prisma);
    },
    $queryRaw: async (morceaux, ...valeurs) => {
      verrous.push({ table: morceaux.join('?').match(/FROM "(\w+)"/)[1], id: valeurs[0] });
      return [];
    },
    user: {
      findUnique: async ({ where }) => {
        const compte = compteDe(where.id);
        return compte ? { ...compte } : null;
      },
      update: async ({ where, data }) => {
        const compte = compteDe(where.id);
        const { tokenVersion, ...champs } = data;
        return Object.assign(compte, champs, tokenVersion ? { tokenVersion: compte.tokenVersion + tokenVersion.increment } : {});
      },
    },
    producerAccessRequest: {
      findUnique: async ({ where }) => {
        const demande = demandeDe(where.id);
        return demande ? { ...demande, user: { email: compteDe(demande.userId)?.email } } : null;
      },
      findFirst: async ({ where }) => base.demandes.find((d) => d.userId === where.userId && d.status === where.status) ?? null,
      findMany: async ({ where }) => base.demandes
        .filter((d) => !where.status || d.status === where.status)
        .map((d) => ({ ...d, user: { ...compteDe(d.userId) } })),
      count: async ({ where }) => base.demandes.filter((d) => !where.status || d.status === where.status).length,
      update: async ({ where, data }) => Object.assign(demandeDe(where.id), data),
    },
    producer: {
      findUnique: async ({ where }) => base.fiches.find((f) => f.id === where.id) ?? null,
      findMany: async ({ where }) => base.fiches.filter((f) => where.id.in.includes(f.id)),
    },
  };

  return { prisma };
});

const {
  getAllAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
  revokeAccessRequest,
} = await import('../../src/controllers/producer-access-requests.controller.js');

const admin = { id: 'admin-0001', email: 'claire@example.org', role: 'ADMIN' };
const membre = { id: 'user-0001', email: 'camille@example.org', role: 'MEMBER', producerId: null, deletedAt: null, tokenVersion: 1 };
const fiche = { id: 'ferme-0001', name: 'La Ferme des Lilas', isExample: false, isActive: true };

const geste = (controleur, body, id = 'demande-1', query = {}) => appeler(controleur, {
  params: { id },
  body,
  query,
  user: admin,
  ip: '203.0.113.10',
});

const approuver = (body = { producerId: fiche.id, password: BON_MOT_DE_PASSE }, id) => geste(approveAccessRequest, body, id);
const refuser = (body = {}, id) => geste(rejectAccessRequest, body, id);
const revoquer = (body = { password: BON_MOT_DE_PASSE }, id) => geste(revokeAccessRequest, body, id);

const cible = { type: 'PRODUCER_ACCESS_REQUEST', id: 'demande-1', label: membre.email };
const echec = (action, severite, motif) => ({ action, severite, cible, details: { motif }, code: motif });

beforeEach(() => {
  base.comptes = [{ ...membre }];
  base.demandes = [{ id: 'demande-1', userId: membre.id, status: 'PENDING', farmClaim: 'Les Lilas' }];
  base.fiches = [
    { ...fiche },
    { id: 'ferme-exemple', name: 'Ferme d\'exemple', isExample: true, isActive: true },
    { id: 'ferme-inactive', name: 'Ancienne ferme', isExample: false, isActive: false },
  ];
  base.panne = null;
  journal.length = 0;
  verrous.length = 0;
});

describe('Approuver une demande d\'accès', () => {
  it('pose rôle et rattachement ensemble, coupe la session, et le consigne', async () => {
    const { statut } = await approuver({ producerId: fiche.id, adminNotes: 'Vu au marché', password: BON_MOT_DE_PASSE });

    expect(statut).toBe(200);
    expect(compteDe(membre.id)).toMatchObject({ role: 'PRODUCER', producerId: fiche.id, tokenVersion: 2 });
    expect(demandeDe('demande-1')).toMatchObject({
      status: 'APPROVED',
      previousRole: 'MEMBER',
      producerId: fiche.id,
      adminNotes: 'Vu au marché',
      processedBy: admin.id,
      processedAt: expect.any(Date),
    });
    expect(verrous).toEqual([{ table: 'User', id: membre.id }, { table: 'ProducerAccessRequest', id: 'demande-1' }]);
    expect(journal).toEqual([{
      action: 'APPROVE_PRODUCER_ACCESS_REQUEST',
      severite: 'CRITICAL',
      cible,
      details: { userId: membre.id, producerId: fiche.id, previousRole: 'MEMBER' },
      code: undefined,
    }]);
  });

  it.each([
    ['une demande déjà traitée', () => { demandeDe('demande-1').status = 'REJECTED'; }, fiche.id, 409, 'DEMANDE_DEJA_TRAITEE'],
    ['un compte supprimé', () => { compteDe(membre.id).deletedAt = new Date(); }, fiche.id, 409, 'COMPTE_SUPPRIME'],
    ['un compte devenu admin', () => { compteDe(membre.id).role = 'ADMIN'; }, fiche.id, 409, 'COMPTE_ADMIN'],
    ['un compte déjà rattaché', () => { compteDe(membre.id).producerId = 'ferme-0002'; }, fiche.id, 409, 'DEJA_RATTACHE'],
    ['une fiche inconnue', () => {}, 'ferme-inconnue', 404, 'FICHE_INTROUVABLE'],
    ['une fiche d\'exemple', () => {}, 'ferme-exemple', 400, 'FICHE_EXEMPLE'],
    ['une fiche désactivée', () => {}, 'ferme-inactive', 409, 'FICHE_INACTIVE'],
  ])('refuse %s, et le consigne', async (_cas, preparer, producerId, statutAttendu, motif) => {
    preparer();
    const avant = { ...compteDe(membre.id) };
    const statutAvant = demandeDe('demande-1').status;

    const { statut } = await approuver({ producerId, password: BON_MOT_DE_PASSE });

    expect(statut).toBe(statutAttendu);
    expect(compteDe(membre.id)).toEqual(avant);
    expect(demandeDe('demande-1').status).toBe(statutAvant);
    expect(journal).toEqual([echec('FAILED_PRODUCER_ACCESS_APPROVAL', 'CRITICAL', motif)]);
  });

  it('refuse sans fiche choisie, avant de demander le mot de passe', async () => {
    const { statut } = await approuver({ password: BON_MOT_DE_PASSE });

    expect(statut).toBe(400);
    expect(compteDe(membre.id).role).toBe('MEMBER');
    expect(journal).toEqual([echec('FAILED_PRODUCER_ACCESS_APPROVAL', 'CRITICAL', 'VALIDATION')]);
  });

  it('refuse une demande introuvable, et le consigne', async () => {
    const { statut } = await approuver(undefined, 'demande-inconnue');

    expect(statut).toBe(404);
    expect(journal).toEqual([{
      ...echec('FAILED_PRODUCER_ACCESS_APPROVAL', 'CRITICAL', 'DEMANDE_INTROUVABLE'),
      cible: { type: 'PRODUCER_ACCESS_REQUEST', id: 'demande-inconnue', label: undefined },
    }]);
  });

  it('redemande le mot de passe de la session', async () => {
    const { statut } = await approuver({ producerId: fiche.id, password: 'une-faute-de-frappe' });

    expect(statut).toBe(403);
    expect(compteDe(membre.id).role).toBe('MEMBER');
    expect(demandeDe('demande-1').status).toBe('PENDING');
    expect(journal).toEqual([{ action: 'FAILED_ACCOUNT_REAUTH' }]);
  });

  it('consigne une panne de base et la laisse remonter', async () => {
    base.panne = new Error('connexion perdue');

    const { erreur } = await approuver();

    expect(erreur.message).toBe('connexion perdue');
    expect(journal).toEqual([echec('FAILED_PRODUCER_ACCESS_APPROVAL', 'CRITICAL', 'ERREUR_TECHNIQUE')]);
  });
});

describe('Refuser une demande d\'accès', () => {
  it('clôt la demande sans toucher au compte, et le consigne', async () => {
    const { statut } = await refuser({ adminNotes: 'Ferme inconnue de l\'association' });

    expect(statut).toBe(200);
    expect(compteDe(membre.id)).toMatchObject({ role: 'MEMBER', producerId: null, tokenVersion: 1 });
    expect(demandeDe('demande-1')).toMatchObject({
      status: 'REJECTED',
      adminNotes: 'Ferme inconnue de l\'association',
      processedBy: admin.id,
      processedAt: expect.any(Date),
    });
    expect(journal).toEqual([{
      action: 'REJECT_PRODUCER_ACCESS_REQUEST',
      severite: 'IMPORTANT',
      cible,
      details: { userId: membre.id },
      code: undefined,
    }]);
  });

  it('refuse une demande déjà traitée', async () => {
    demandeDe('demande-1').status = 'APPROVED';

    const { statut } = await refuser();

    expect(statut).toBe(409);
    expect(demandeDe('demande-1').status).toBe('APPROVED');
    expect(journal).toEqual([echec('FAILED_PRODUCER_ACCESS_REJECTION', 'IMPORTANT', 'DEMANDE_DEJA_TRAITEE')]);
  });

  it('refuse des notes trop longues', async () => {
    const { statut } = await refuser({ adminNotes: 'x'.repeat(2001) });

    expect(statut).toBe(400);
    expect(demandeDe('demande-1').status).toBe('PENDING');
    expect(journal).toEqual([echec('FAILED_PRODUCER_ACCESS_REJECTION', 'IMPORTANT', 'VALIDATION')]);
  });
});

describe('Révoquer un accès producteur', () => {
  beforeEach(() => {
    Object.assign(compteDe(membre.id), { role: 'PRODUCER', producerId: fiche.id, tokenVersion: 5 });
    Object.assign(demandeDe('demande-1'), { status: 'APPROVED', previousRole: 'VOLUNTEER', producerId: fiche.id });
  });

  it('rend le rôle d\'avant, détache la ferme, coupe la session, et le consigne', async () => {
    const { statut } = await revoquer();

    expect(statut).toBe(200);
    expect(compteDe(membre.id)).toMatchObject({ role: 'VOLUNTEER', producerId: null, tokenVersion: 6 });
    expect(demandeDe('demande-1')).toMatchObject({ status: 'REVOKED', revokedBy: admin.id, revokedAt: expect.any(Date) });
    expect(journal).toEqual([{
      action: 'REVOKE_PRODUCER_ACCESS',
      severite: 'CRITICAL',
      cible,
      details: { userId: membre.id, producerId: fiche.id, restoredRole: 'VOLUNTEER' },
      code: undefined,
    }]);
  });

  it('refuse un accès qui n\'est pas actif', async () => {
    demandeDe('demande-1').status = 'PENDING';

    const { statut } = await revoquer();

    expect(statut).toBe(409);
    expect(compteDe(membre.id)).toMatchObject({ role: 'PRODUCER', producerId: fiche.id });
    expect(journal).toEqual([echec('FAILED_PRODUCER_ACCESS_REVOCATION', 'CRITICAL', 'ACCES_NON_ACTIF')]);
  });

  it('redemande le mot de passe de la session', async () => {
    const { statut } = await revoquer({ password: 'une-faute-de-frappe' });

    expect(statut).toBe(403);
    expect(compteDe(membre.id)).toMatchObject({ role: 'PRODUCER', producerId: fiche.id });
    expect(journal).toEqual([{ action: 'FAILED_ACCOUNT_REAUTH' }]);
  });
});

describe('Lister les demandes d\'accès', () => {
  it('filtre par statut et donne le nom de la ferme rattachée', async () => {
    base.demandes.push({ id: 'demande-2', userId: membre.id, status: 'APPROVED', producerId: fiche.id });

    const { statut, corps } = await geste(getAllAccessRequests, undefined, undefined, { status: 'APPROVED' });

    expect(statut).toBe(200);
    expect(corps.data.requests).toHaveLength(1);
    expect(corps.data.requests[0]).toMatchObject({ id: 'demande-2', producer: { id: fiche.id, name: fiche.name } });
    expect(corps.data.pagination.total).toBe(1);
  });

  it('refuse un statut inconnu', async () => {
    const { statut } = await geste(getAllAccessRequests, undefined, undefined, { status: 'ARCHIVED' });

    expect(statut).toBe(400);
  });
});
