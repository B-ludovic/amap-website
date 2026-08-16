/* L'accusé de suppression de compte.

   Le droit à l'effacement s'exerce en un clic, et jusqu'ici sans réponse : rien
   ne disait à l'adhérent que sa demande avait abouti, ni quand ses données
   partiraient réellement. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';

const { base, accuses } = vi.hoisted(() => ({
  base: { comptes: [] },
  accuses: [],
}));

vi.mock('../../src/services/email.service.js', () => ({
  default: {
    sendAccountDeleted: async (user, { effaceLe }) => {
      accuses.push({ email: user.email, prenom: user.firstName, effaceLe });
      return { success: true };
    },
  },
}));

vi.mock('../../src/services/audit.service.js', () => ({ logAudit: async () => {} }));

const trouver = (id) => base.comptes.find((c) => c.id === id);

vi.mock('../../src/config/database.js', () => ({
  prisma: {
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
  },
}));

const { deleteMe } = await import('../../src/controllers/auth.controller.js');

const compte = (attributs = {}) => ({
  id: 'user-0001',
  email: 'camille@example.org',
  firstName: 'Camille',
  role: 'MEMBER',
  deletedAt: null,
  tokenVersion: 2,
  ...attributs,
});

const supprimer = (id = 'user-0001') => appeler(deleteMe, { user: { id }, ip: '203.0.113.10' });

beforeEach(() => {
  accuses.length = 0;
  base.comptes = [compte()];
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
