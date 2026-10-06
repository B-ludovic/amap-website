/* L'accusé de suppression de compte.

   Le droit à l'effacement s'exerce en un clic, et jusqu'ici sans réponse : rien
   ne disait à l'adhérent que sa demande avait abouti, ni quand ses données
   partiraient réellement. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { appeler } from '../helpers/expressFactice.js';

const { base, accuses, journal, depart } = vi.hoisted(() => ({
  base: { comptes: [] },
  accuses: [],
  journal: [],
  depart: { places: [], liberations: [], avis: [] },
}));

vi.mock('../../src/services/email.service.js', () => ({
  default: {
    sendAccountDeleted: async (user, { effaceLe, permanencesLiberees }) => {
      accuses.push({ email: user.email, prenom: user.firstName, effaceLe, permanencesLiberees });
      return { success: true };
    },
  },
}));

vi.mock('../../src/services/audit.service.js', () => ({
  logAudit: async (_req, action, _severite, _cible, details) => { journal.push({ action, details }); },
}));

vi.mock('../../src/services/shiftRelease.service.js', () => ({
  releaseUpcomingShifts: async (_tx, userId) => {
    depart.liberations.push(userId);
    return depart.places;
  },
  announceWithdrawal: async (place, options) => { depart.avis.push({ shiftId: place.shiftId, ...options }); },
}));

const trouver = (id) => base.comptes.find((c) => c.id === id);

vi.mock('../../src/config/database.js', () => {
  const prisma = {
    $transaction: async (travail) => travail(prisma),
    user: {
      findUnique: async ({ where }) => {
        const compte = trouver(where.id);
        return compte ? { ...compte } : null;
      },
      count: async ({ where }) => base.comptes.filter((c) => c.role === where.role && c.deletedAt === null).length,
      update: async ({ where, data }) => {
        const compte = trouver(where.id);
        const { tokenVersion, ...champs } = data;
        return Object.assign(compte, champs, { tokenVersion: compte.tokenVersion + tokenVersion.increment });
      },
    },
  };

  return { prisma };
});

const { deleteMe } = await import('../../src/controllers/auth.controller.js');

const MOT_DE_PASSE = 'le-bon-mot-de-passe';
const EMPREINTE = bcrypt.hashSync(MOT_DE_PASSE, 4);

const compte = (attributs = {}) => ({
  id: 'user-0001',
  email: 'camille@example.org',
  firstName: 'Camille',
  role: 'MEMBER',
  deletedAt: null,
  tokenVersion: 2,
  password: EMPREINTE,
  ...attributs,
});

const supprimer = (id = 'user-0001', password = MOT_DE_PASSE) => appeler(deleteMe, {
  user: { id },
  body: password === null ? {} : { password },
  ip: '203.0.113.10',
});

beforeEach(() => {
  accuses.length = 0;
  journal.length = 0;
  base.comptes = [compte()];
  depart.places = [];
  depart.liberations = [];
  depart.avis = [];
});

describe('Supprimer son compte se confirme par écrit', () => {
  it('accuse réception à l\'adresse du compte', async () => {
    const { statut } = await supprimer();

    expect(statut).toBe(200);
    expect(accuses).toHaveLength(1);
    expect(accuses[0]).toMatchObject({ email: 'camille@example.org', prenom: 'Camille' });
  });

  /* La date vient du job de purge : l'annoncer à quatre-vingt-dix jours quand
     le balayage en attend cent serait pire que de ne rien dire. */
  it('annonce l\'effacement à quatre-vingt-dix jours', async () => {
    await supprimer();

    const jours = Math.round((accuses[0].effaceLe - new Date()) / (24 * 60 * 60 * 1000));
    expect(jours).toBe(90);
  });

  it('ferme le compte et révoque les sessions ouvertes', async () => {
    await supprimer();

    expect(trouver('user-0001').deletedAt).toBeInstanceOf(Date);
    expect(trouver('user-0001').tokenVersion).toBe(3);
  });

  it('n\'écrit rien quand le compte a déjà été supprimé', async () => {
    base.comptes = [compte({ deletedAt: new Date() })];

    const { statut } = await supprimer();

    expect(statut).toBe(404);
    expect(accuses).toHaveLength(0);
  });

  /* Le dernier administrateur ne peut pas partir : le compte reste ouvert, et
     un accusé de suppression serait un mensonge de plus. */
  it('n\'écrit rien quand le dernier administrateur tente de partir', async () => {
    base.comptes = [compte({ role: 'ADMIN' })];

    const { statut, message } = await supprimer();

    expect(statut).toBe(400);
    expect(message).toBe('Impossible de supprimer le dernier administrateur');
    expect(accuses).toHaveLength(0);
    expect(trouver('user-0001').deletedAt).toBeNull();
  });
});

describe('Supprimer son compte redemande le mot de passe', () => {
  it('refuse sans mot de passe, et le consigne', async () => {
    const { statut, message } = await supprimer('user-0001', null);

    expect(statut).toBe(403);
    expect(message).toBe('Mot de passe incorrect : votre compte n\'a pas été supprimé');
    expect(trouver('user-0001').deletedAt).toBeNull();
    expect(accuses).toHaveLength(0);
    expect(depart.liberations).toHaveLength(0);
    expect(journal).toEqual([{
      action: 'FAILED_ACCOUNT_REAUTH',
      details: { geste: 'DELETE_USER', initiatedByUser: true, motif: 'mot de passe absent' },
    }]);
  });

  it('refuse un mot de passe faux sans toucher au compte', async () => {
    const { statut } = await supprimer('user-0001', 'une-faute-de-frappe');

    expect(statut).toBe(403);
    expect(trouver('user-0001').deletedAt).toBeNull();
    expect(trouver('user-0001').tokenVersion).toBe(2);
    expect(journal[0].details.motif).toBe('mot de passe incorrect');
  });
});

describe('Supprimer son compte libère ses permanences à venir', () => {
  it('libère les places, prévient l\'équipe et le dit dans l\'accusé', async () => {
    depart.places = [{ shiftId: 'mercredi-14' }, { shiftId: 'mercredi-21' }];

    await supprimer();

    expect(depart.liberations).toEqual(['user-0001']);
    expect(depart.avis).toEqual([
      { shiftId: 'mercredi-14', accountDeleted: true },
      { shiftId: 'mercredi-21', accountDeleted: true },
    ]);
    expect(accuses[0].permanencesLiberees).toBe(2);
    expect(journal.at(-1)).toEqual({ action: 'DELETE_USER', details: { initiatedByUser: true, releasedShifts: 2 } });
  });

  it('ne prévient personne quand aucune place n\'était prise', async () => {
    await supprimer();

    expect(depart.liberations).toEqual(['user-0001']);
    expect(depart.avis).toHaveLength(0);
    expect(accuses[0].permanencesLiberees).toBe(0);
  });
});
