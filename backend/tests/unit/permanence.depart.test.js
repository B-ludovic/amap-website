/* Un compte qui ferme libère ses permanences à venir. Les lignes passées restent :
   elles disent qui a tenu quoi. */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

const { base, avis } = vi.hoisted(() => ({
  base: { shifts: [], lignes: [], comptes: [] },
  avis: [],
}));

vi.mock('../../src/services/email.service.js', () => ({
  default: {
    sendShiftWithdrawalNotice: async (shift, admin, { volunteer, confirmedCount, accountDeleted }) => {
      avis.push({ a: admin.email, shiftId: shift.id, qui: volunteer.firstName, confirmedCount, accountDeleted });
      return { success: true };
    },
  },
}));

vi.mock('../../src/config/database.js', () => {
  const satisfait = (valeur, attendu) => {
    if (attendu && typeof attendu === 'object' && !(attendu instanceof Date)) {
      if ('in' in attendu) return attendu.in.includes(valeur);
      if ('notIn' in attendu) return !attendu.notIn.includes(valeur);
      if ('gte' in attendu) return new Date(valeur) >= attendu.gte;
    }
    return valeur === attendu;
  };

  const correspond = (ligne, where = {}) => Object.entries(where).every(([cle, attendu]) => (cle === 'shift'
    ? correspond(base.shifts.find((s) => s.id === ligne.shiftId), attendu)
    : satisfait(ligne[cle], attendu)));

  const prisma = {
    user: {
      findMany: async ({ where }) => base.comptes.filter((c) => correspond(c, where)).map((c) => ({ ...c })),
    },
    shiftVolunteer: {
      findMany: async ({ where }) => base.lignes.filter((l) => correspond(l, where)).map((l) => ({
        ...l,
        shift: { ...base.shifts.find((s) => s.id === l.shiftId) },
        user: { ...base.comptes.find((c) => c.id === l.userId) },
      })),
      updateMany: async ({ where, data }) => {
        const lignes = base.lignes.filter((l) => correspond(l, where));
        lignes.forEach((l) => Object.assign(l, data));
        return { count: lignes.length };
      },
      count: async ({ where }) => base.lignes.filter((l) => correspond(l, where)).length,
    },
  };

  return { prisma };
});

const { prisma } = await import('../../src/config/database.js');
const { releaseUpcomingShifts, announceWithdrawal } = await import('../../src/services/shiftRelease.service.js');

vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-10-06T12:00:00Z'));

afterAll(() => {
  vi.useRealTimers();
});

const CLAIRE = { id: 'claire', email: 'claire@example.org', firstName: 'Claire', role: 'ADMIN', deletedAt: null };
const PAUL = { id: 'paul', email: 'paul@example.org', firstName: 'Paul', role: 'ADMIN', deletedAt: null };
const ANCIEN = { id: 'ancien', email: 'ancien@example.org', firstName: 'Ancien', role: 'ADMIN', deletedAt: new Date('2026-09-01T00:00:00Z') };
const CAMILLE = { id: 'camille', email: 'camille@example.org', firstName: 'Camille', lastName: 'Renard', role: 'MEMBER', deletedAt: null };
const ALEX = { id: 'alex', email: 'alex@example.org', firstName: 'Alex', role: 'MEMBER', deletedAt: null };

const ligne = (shiftId, userId, status) => ({ id: `${shiftId}:${userId}`, shiftId, userId, status });
const statut = (shiftId, userId) => base.lignes.find((l) => l.shiftId === shiftId && l.userId === userId).status;

beforeEach(() => {
  avis.length = 0;
  base.comptes = [CLAIRE, PAUL, ANCIEN, CAMILLE, ALEX];
  base.shifts = [
    { id: 'aujourdhui', distributionDate: new Date('2026-10-06T00:00:00Z'), volunteersNeeded: 2 },
    { id: 'mercredi-07', distributionDate: new Date('2026-10-07T00:00:00Z'), volunteersNeeded: 2 },
    { id: 'mercredi-14', distributionDate: new Date('2026-10-14T00:00:00Z'), volunteersNeeded: 2 },
    { id: 'mercredi-21', distributionDate: new Date('2026-10-21T00:00:00Z'), volunteersNeeded: 2 },
    { id: 'mercredi-30-09', distributionDate: new Date('2026-09-30T00:00:00Z'), volunteersNeeded: 2 },
  ];
  base.lignes = [
    ligne('aujourdhui', CAMILLE.id, 'CONFIRMED'),
    ligne('mercredi-07', CAMILLE.id, 'PENDING'),
    ligne('mercredi-14', CAMILLE.id, 'CONFIRMED'),
    ligne('mercredi-14', ALEX.id, 'CONFIRMED'),
    ligne('mercredi-21', CAMILLE.id, 'REFUSED'),
    ligne('mercredi-30-09', CAMILLE.id, 'CONFIRMED'),
  ];
});

describe('Libérer les permanences d\'un compte qui ferme', () => {
  it('passe en désistement les places confirmées et les propositions à venir, distribution du jour comprise', async () => {
    await releaseUpcomingShifts(prisma, CAMILLE.id);

    expect(statut('aujourdhui', CAMILLE.id)).toBe('CANCELLED');
    expect(statut('mercredi-07', CAMILLE.id)).toBe('CANCELLED');
    expect(statut('mercredi-14', CAMILLE.id)).toBe('CANCELLED');
  });

  it('garde l\'historique, les refus et les places des autres', async () => {
    await releaseUpcomingShifts(prisma, CAMILLE.id);

    expect(statut('mercredi-30-09', CAMILLE.id)).toBe('CONFIRMED');
    expect(statut('mercredi-21', CAMILLE.id)).toBe('REFUSED');
    expect(statut('mercredi-14', ALEX.id)).toBe('CONFIRMED');
  });

  it('rend seulement les places confirmées, celles qui manqueront à l\'équipe', async () => {
    const places = await releaseUpcomingShifts(prisma, CAMILLE.id);

    expect(places.map((place) => place.shiftId).sort()).toEqual(['aujourdhui', 'mercredi-14']);
    expect(places[0].user.firstName).toBe('Camille');
  });
});

describe('Prévenir l\'équipe d\'une place libérée', () => {
  const place = () => ({
    shiftId: 'mercredi-14',
    userId: CAMILLE.id,
    shift: base.shifts.find((s) => s.id === 'mercredi-14'),
    user: CAMILLE,
  });

  it('écrit aux admins actifs, sauf à l\'auteur de la suppression', async () => {
    base.lignes = [ligne('mercredi-14', ALEX.id, 'CONFIRMED')];

    await announceWithdrawal(place(), { accountDeleted: true, actorId: PAUL.id });

    expect(avis).toEqual([
      { a: CLAIRE.email, shiftId: 'mercredi-14', qui: 'Camille', confirmedCount: 1, accountDeleted: true },
    ]);
  });

  it('reste un désistement ordinaire par défaut', async () => {
    await announceWithdrawal(place());

    expect(avis.map((a) => [a.a, a.accountDeleted])).toEqual([[CLAIRE.email, false], [PAUL.email, false]]);
  });
});
