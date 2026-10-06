/* Changer un rôle ou supprimer un compte redemande le mot de passe de la session,
   comme la marche arrière sur un chèque. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { appeler } from '../helpers/expressFactice.js';

const { base, journal, messages, depart } = vi.hoisted(() => ({
  base: { comptes: [] },
  journal: [],
  messages: [],
  depart: { places: [], liberations: [], avis: [] },
}));

vi.mock('../../src/services/shiftRelease.service.js', () => ({
  releaseUpcomingShifts: async (_tx, userId) => {
    depart.liberations.push(userId);
    return depart.places;
  },
  announceWithdrawal: async (place, options) => { depart.avis.push({ shiftId: place.shiftId, ...options }); },
}));

vi.mock('../../src/services/email.service.js', () => ({
  default: {
    sendRoleChanged: async (user, details) => {
      messages.push({ email: user.email, ...details });
      return { success: true };
    },
  },
}));

vi.mock('../../src/services/audit.service.js', () => ({
  logAudit: async (_req, action, _severite, cible, details) => { journal.push({ action, cible, details }); },
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
      update: async ({ where, data }) => ({ ...Object.assign(trouver(where.id), data) }),
    },
  };

  return { prisma };
});

const { changeUserRole, deleteUser } = await import('../../src/controllers/admin.controller.js');

const MOT_DE_PASSE_ADMIN = 'mot-de-passe-de-la-session';
const MOT_DE_PASSE_CIBLE = 'mot-de-passe-du-compte-vise';

const admin = {
  id: 'admin-0001',
  email: 'claire@example.org',
  firstName: 'Claire',
  lastName: 'Martin',
  role: 'ADMIN',
  deletedAt: null,
  password: bcrypt.hashSync(MOT_DE_PASSE_ADMIN, 4),
};

const cible = {
  id: 'user-0002',
  email: 'camille@example.org',
  firstName: 'Camille',
  lastName: 'Durand',
  role: 'MEMBER',
  deletedAt: null,
  password: bcrypt.hashSync(MOT_DE_PASSE_CIBLE, 4),
};

const requete = (body) => ({
  params: { userId: cible.id },
  body,
  user: { id: admin.id, email: admin.email, role: 'ADMIN' },
  ip: '203.0.113.10',
});

const nommerAdmin = (password) => appeler(changeUserRole, requete({ role: 'ADMIN', password }));
const supprimer = (password) => appeler(deleteUser, requete(password === undefined ? {} : { password }));

beforeEach(() => {
  journal.length = 0;
  messages.length = 0;
  base.comptes = [{ ...admin }, { ...cible }];
  depart.places = [];
  depart.liberations = [];
  depart.avis = [];
});

describe('Changer un rôle redemande le mot de passe', () => {
  it('refuse sans mot de passe, et le consigne', async () => {
    const { statut, message } = await nommerAdmin(undefined);

    expect(statut).toBe(403);
    expect(message).toBe('Mot de passe incorrect : le rôle n\'a pas été modifié');
    expect(trouver(cible.id).role).toBe('MEMBER');
    expect(messages).toHaveLength(0);
    expect(journal).toEqual([{
      action: 'FAILED_ACCOUNT_REAUTH',
      cible: { type: 'USER', id: cible.id, label: cible.email },
      details: { geste: 'CHANGE_USER_ROLE', oldRole: 'MEMBER', newRole: 'ADMIN', motif: 'mot de passe absent' },
    }]);
  });

  it('refuse un mot de passe faux', async () => {
    const { statut } = await nommerAdmin('une-faute-de-frappe');

    expect(statut).toBe(403);
    expect(trouver(cible.id).role).toBe('MEMBER');
    expect(journal[0].details.motif).toBe('mot de passe incorrect');
  });

  /* Le mot de passe prouve qui tient la session, pas que le compte visé consent. */
  it('refuse le mot de passe du compte visé', async () => {
    const { statut } = await nommerAdmin(MOT_DE_PASSE_CIBLE);

    expect(statut).toBe(403);
    expect(trouver(cible.id).role).toBe('MEMBER');
  });

  it('accepte le mot de passe de la session', async () => {
    const { statut } = await nommerAdmin(MOT_DE_PASSE_ADMIN);

    expect(statut).toBe(200);
    expect(trouver(cible.id).role).toBe('ADMIN');
    expect(journal.map((ligne) => ligne.action)).toEqual(['CHANGE_USER_ROLE']);
    expect(messages).toEqual([{ email: cible.email, role: 'ADMIN', ancienRole: 'MEMBER' }]);
  });
});

describe('Supprimer un compte redemande le mot de passe', () => {
  it('refuse sans mot de passe, et le consigne', async () => {
    const { statut, message } = await supprimer(undefined);

    expect(statut).toBe(403);
    expect(message).toBe('Mot de passe incorrect : le compte n\'a pas été supprimé');
    expect(trouver(cible.id).deletedAt).toBeNull();
    expect(journal).toEqual([{
      action: 'FAILED_ACCOUNT_REAUTH',
      cible: { type: 'USER', id: cible.id, label: cible.email },
      details: { geste: 'DELETE_USER', motif: 'mot de passe absent' },
    }]);
  });

  it('refuse un mot de passe faux', async () => {
    const { statut } = await supprimer('une-faute-de-frappe');

    expect(statut).toBe(403);
    expect(trouver(cible.id).deletedAt).toBeNull();
    expect(depart.liberations).toHaveLength(0);
  });

  it('accepte le mot de passe de la session', async () => {
    const { statut } = await supprimer(MOT_DE_PASSE_ADMIN);

    expect(statut).toBe(200);
    expect(trouver(cible.id).deletedAt).toBeInstanceOf(Date);
    expect(journal.map((ligne) => ligne.action)).toEqual(['DELETE_USER']);
  });
});

describe('Supprimer un compte libère ses permanences à venir', () => {
  it('libère les places et prévient les autres admins, pas l\'auteur du geste', async () => {
    depart.places = [{ shiftId: 'mercredi-14' }];

    const { corps } = await supprimer(MOT_DE_PASSE_ADMIN);

    expect(depart.liberations).toEqual([cible.id]);
    expect(depart.avis).toEqual([{ shiftId: 'mercredi-14', accountDeleted: true, actorId: admin.id }]);
    expect(corps.releasedShifts).toBe(1);
  });
});
