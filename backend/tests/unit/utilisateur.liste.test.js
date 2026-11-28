/* La liste admin des utilisateurs dit, pour un compte producteur, à quelle
   ferme il est rattaché. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';

const { base } = vi.hoisted(() => ({ base: { comptes: [] } }));

vi.mock('../../src/services/audit.service.js', () => ({ logAudit: async () => {} }));
vi.mock('../../src/services/email.service.js', () => ({ default: {} }));

// Ne rend que ce que le select demande, relations comprises.
const choisir = (ligne, select) => {
  if (ligne == null) return null;
  if (Array.isArray(ligne)) return ligne.map((element) => choisir(element, select));
  return Object.fromEntries(Object.entries(select).map(([cle, demande]) => [
    cle,
    demande === true ? ligne[cle] : choisir(ligne[cle], demande.select),
  ]));
};

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: {
      findMany: async ({ where, select }) => base.comptes
        .filter((c) => !where.role || c.role === where.role)
        .map((c) => choisir(c, select)),
      count: async ({ where }) => base.comptes.filter((c) => !where.role || c.role === where.role).length,
    },
  },
}));

const { getAllUsers } = await import('../../src/controllers/admin.controller.js');

const admin = { id: 'admin-0001', role: 'ADMIN' };
const compte = (champs) => ({
  email: 'x@example.org',
  firstName: 'Paul',
  lastName: 'Martin',
  phone: null,
  emailVerified: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  producer: null,
  _count: { subscriptions: 1, shiftVolunteers: 0 },
  subscriptions: [{ _count: { pickups: 3 } }],
  ...champs,
});

beforeEach(() => {
  base.comptes = [
    compte({ id: 'user-0001', role: 'PRODUCER', producer: { id: 'ferme-0001', name: 'La Ferme des Lilas', email: 'lilas@example.org' } }),
    compte({ id: 'user-0002', role: 'MEMBER' }),
  ];
});

describe('Liste admin des utilisateurs', () => {
  it('donne le nom de la ferme d\'un compte producteur, rien d\'autre de sa fiche', async () => {
    const { corps } = await appeler(getAllUsers, { query: {}, user: admin });
    const [producteur, adherent] = corps.data.users;

    expect(producteur.producer).toEqual({ id: 'ferme-0001', name: 'La Ferme des Lilas' });
    expect(adherent.producer).toBeNull();
  });

  it('filtre sur le rôle producteur', async () => {
    const { corps } = await appeler(getAllUsers, { query: { role: 'PRODUCER' }, user: admin });

    expect(corps.data.users.map((u) => u.id)).toEqual(['user-0001']);
  });
});
