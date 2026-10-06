/* L'adhérent se propose, un admin accepte ou refuse. Une proposition n'occupe
   aucune place ; seule l'acceptation, ou le placement direct, en prend une. */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';

const { base, envois, journal } = vi.hoisted(() => ({
  base: { shifts: [], lignes: [], contrats: [], comptes: [] },
  envois: [],
  journal: [],
}));

vi.mock('../../src/services/email.service.js', () => {
  const noter = (type) => async (shift, user) => {
    envois.push({ type, email: user.email, shiftId: shift.id });
    return { success: true };
  };

  return {
    default: {
      sendShiftConfirmation: noter('confirmation'),
      sendShiftRefusal: noter('refus'),
      sendShiftWithdrawal: noter('desistement'),
      sendShiftCancellation: noter('annulation'),
      sendShiftWithdrawalNotice: async (shift, admin, { volunteer, confirmedCount }) => {
        envois.push({ type: 'avis', email: admin.email, shiftId: shift.id, qui: volunteer.firstName, confirmedCount });
        return { success: true };
      },
      sendShiftRemoval: async (shift, user) => {
        envois.push({ type: 'retrait', email: user.email, jour: new Date(shift.distributionDate).toISOString().slice(0, 10) });
        return { success: true };
      },
      sendShiftRescheduled: async (shift, user, { before, pending }) => {
        envois.push({
          type: 'deplacement',
          email: user.email,
          pending,
          avant: `${new Date(before.distributionDate).toISOString().slice(0, 10)} ${before.startTime}`,
          apres: `${new Date(shift.distributionDate).toISOString().slice(0, 10)} ${shift.startTime}`,
        });
        return { success: true };
      },
    },
  };
});

vi.mock('../../src/services/audit.service.js', () => ({
  logAudit: async (_req, action, _severite, _cible, details) => { journal.push({ action, details }); },
}));

vi.mock('../../src/services/closure.service.js', () => ({
  findClosureCovering: async () => null,
  describeClosure: () => '',
}));

vi.mock('../../src/config/database.js', () => {
  const satisfait = (valeur, attendu) => {
    if (attendu && typeof attendu === 'object' && !(attendu instanceof Date)) {
      if ('in' in attendu) return attendu.in.includes(valeur);
      if ('notIn' in attendu) return !attendu.notIn.includes(valeur);
      if ('not' in attendu) return valeur !== attendu.not;
      const date = new Date(valeur);
      return (!('gte' in attendu) || date >= attendu.gte)
        && (!('lte' in attendu) || date <= attendu.lte)
        && (!('lt' in attendu) || date < attendu.lt);
    }
    return valeur === attendu;
  };

  const correspond = (ligne, where = {}) => Boolean(ligne) && Object.entries(where).every(([cle, attendu]) => {
    if (cle === 'shiftId_userId') return ligne.shiftId === attendu.shiftId && ligne.userId === attendu.userId;
    if (cle === 'shift') return correspond(base.shifts.find((s) => s.id === ligne.shiftId), attendu);
    if (cle === 'user') return correspond(base.comptes.find((c) => c.id === ligne.userId), attendu);
    return satisfait(ligne[cle], attendu);
  });

  const habiller = (ligne, include = {}) => ({
    ...ligne,
    ...(include.shift && { shift: { ...base.shifts.find((s) => s.id === ligne.shiftId) } }),
    ...(include.user && { user: { ...base.comptes.find((c) => c.id === ligne.userId) } }),
  });

  const avecEquipe = (shift) => ({
    ...shift,
    volunteers: base.lignes.filter((l) => l.shiftId === shift.id).map((l) => habiller(l, { user: true })),
  });

  const prisma = {
    $queryRaw: async () => [],
    $transaction: async (travail) => travail(prisma),
    subscription: {
      findFirst: async ({ where }) => base.contrats.find((c) => correspond(c, where)) ?? null,
    },
    user: {
      findMany: async ({ where }) => base.comptes.filter((c) => correspond(c, where)).map((c) => ({ ...c })),
    },
    shift: {
      findUnique: async ({ where, include }) => {
        const shift = base.shifts.find((s) => s.id === where.id);
        if (!shift) return null;
        return include?.volunteers ? avecEquipe(shift) : { ...shift };
      },
      count: async () => base.shifts.length,
      findMany: async () => base.shifts.map(avecEquipe),
      update: async ({ where, data }) => {
        const shift = base.shifts.find((s) => s.id === where.id);
        Object.assign(shift, Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)));
        return avecEquipe(shift);
      },
    },
    shiftVolunteer: {
      findUnique: async ({ where, include }) => {
        const ligne = base.lignes.find((l) => correspond(l, where));
        return ligne ? habiller(ligne, include) : null;
      },
      findMany: async ({ where, include }) => base.lignes.filter((l) => correspond(l, where)).map((l) => habiller(l, include)),
      count: async ({ where }) => base.lignes.filter((l) => correspond(l, where)).length,
      create: async ({ data }) => {
        const ligne = { id: `ligne-${base.lignes.length + 1}`, role: null, createdAt: new Date(), ...data };
        base.lignes.push(ligne);
        return { ...ligne };
      },
      createMany: async ({ data }) => {
        data.forEach((d, i) => base.lignes.push({ id: `ligne-ajoutee-${i}`, createdAt: new Date(), ...d }));
        return { count: data.length };
      },
      update: async ({ where, data, include }) => {
        const ligne = base.lignes.find((l) => l.id === where.id);
        Object.assign(ligne, data);
        return habiller(ligne, include);
      },
      updateMany: async ({ where, data }) => {
        const lignes = base.lignes.filter((l) => correspond(l, where));
        lignes.forEach((l) => Object.assign(l, data));
        return { count: lignes.length };
      },
      deleteMany: async ({ where }) => {
        const avant = base.lignes.length;
        base.lignes = base.lignes.filter((l) => !correspond(l, where));
        return { count: avant - base.lignes.length };
      },
    },
  };

  return { prisma };
});

const { prisma } = await import('../../src/config/database.js');
const {
  proposeShift,
  leaveShift,
  acceptProposal,
  refuseProposal,
  getPendingProposals,
  getAllShifts,
  updateShift,
} = await import('../../src/controllers/shifts.controller.js');

/* Le 6 octobre 2026 à midi : les délais (passé, moins de 48 h) se lisent par
   rapport à cette date, quel que soit le jour où la suite tourne. */
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-10-06T12:00:00Z'));

afterAll(() => {
  vi.useRealTimers();
});

const ADMIN = { id: 'admin-1', email: 'claire@example.org', firstName: 'Claire', lastName: 'Martin', role: 'ADMIN', deletedAt: null };
const CAMILLE = { id: 'camille', email: 'camille@example.org', firstName: 'Camille', lastName: 'Renard', role: 'MEMBER', deletedAt: null };
const DOMINIQUE = { id: 'dominique', email: 'dominique@example.org', firstName: 'Dominique', lastName: 'Petit', role: 'MEMBER', deletedAt: null };
const ALEX = { id: 'alex', email: 'alex@example.org', firstName: 'Alex', lastName: 'Morel', role: 'MEMBER', deletedAt: null };
const BEA = { id: 'bea', email: 'bea@example.org', firstName: 'Béa', lastName: 'Simon', role: 'MEMBER', deletedAt: null };

const A_VENIR = 'mercredi-14';
const PASSEE = 'mercredi-30';
const DEMAIN = 'mercredi-07';

const ligne = (shiftId, userId, status) => ({
  id: `${shiftId}:${userId}`, shiftId, userId, status, role: null, createdAt: new Date('2026-10-01T09:00:00Z'),
});

const statut = (shiftId, userId) => base.lignes.find((l) => l.shiftId === shiftId && l.userId === userId)?.status;

const commeAdherent = (compte, params = {}) => ({ params, query: {}, body: {}, user: { id: compte.id, email: compte.email, role: 'MEMBER' } });
const commeAdmin = (params = {}, body = {}) => ({ params, query: {}, body, user: { id: ADMIN.id, email: ADMIN.email, role: 'ADMIN' } });

beforeEach(() => {
  envois.length = 0;
  journal.length = 0;
  base.comptes = [ADMIN, CAMILLE, DOMINIQUE, ALEX, BEA];
  base.shifts = [
    { id: A_VENIR, distributionDate: new Date('2026-10-14T00:00:00Z'), startTime: '18:15', endTime: '19:15', volunteersNeeded: 2, notes: null },
    { id: PASSEE, distributionDate: new Date('2026-09-30T00:00:00Z'), startTime: '18:15', endTime: '19:15', volunteersNeeded: 2, notes: null },
    { id: DEMAIN, distributionDate: new Date('2026-10-07T00:00:00Z'), startTime: '18:15', endTime: '19:15', volunteersNeeded: 2, notes: null },
  ];
  base.lignes = [];
  base.contrats = [
    { id: 'contrat-camille', userId: CAMILLE.id, status: 'ACTIVE', startDate: new Date('2026-01-07T00:00:00Z'), endDate: new Date('2027-01-07T00:00:00Z') },
    { id: 'contrat-alex', userId: ALEX.id, status: 'ACTIVE', startDate: new Date('2026-01-07T00:00:00Z'), endDate: new Date('2027-01-07T00:00:00Z') },
    { id: 'contrat-bea', userId: BEA.id, status: 'PAUSED', startDate: new Date('2026-01-07T00:00:00Z'), endDate: new Date('2027-01-07T00:00:00Z') },
  ];
});

describe('Se proposer pour une permanence', () => {
  it('pose une proposition en attente, sans envoyer d\'email', async () => {
    const { statut: code } = await appeler(proposeShift, commeAdherent(CAMILLE, { id: A_VENIR }));

    expect(code).toBe(201);
    expect(statut(A_VENIR, CAMILLE.id)).toBe('PENDING');
    expect(envois).toHaveLength(0);
  });

  it('est réservé aux adhérents dont le contrat couvre la date', async () => {
    const { statut: code } = await appeler(proposeShift, commeAdherent(DOMINIQUE, { id: A_VENIR }));

    expect(code).toBe(403);
    expect(base.lignes).toHaveLength(0);
  });

  it('refuse une permanence passée', async () => {
    const { statut: code } = await appeler(proposeShift, commeAdherent(CAMILLE, { id: PASSEE }));

    expect(code).toBe(400);
  });

  it('refuse une permanence déjà complète', async () => {
    base.lignes = [ligne(A_VENIR, ALEX.id, 'CONFIRMED'), ligne(A_VENIR, BEA.id, 'CONFIRMED')];

    const { statut: code } = await appeler(proposeShift, commeAdherent(CAMILLE, { id: A_VENIR }));

    expect(code).toBe(409);
  });

  it('ne se renouvelle pas pour une date déjà refusée', async () => {
    base.lignes = [ligne(A_VENIR, CAMILLE.id, 'REFUSED')];

    const { statut: code, message } = await appeler(proposeShift, commeAdherent(CAMILLE, { id: A_VENIR }));

    expect(code).toBe(409);
    expect(message).toBe('Vous ne pouvez pas vous proposer à nouveau pour cette date');
    expect(statut(A_VENIR, CAMILLE.id)).toBe('REFUSED');
  });

  it('fait d\'un ancien désistement une nouvelle proposition', async () => {
    base.lignes = [ligne(A_VENIR, CAMILLE.id, 'CANCELLED')];

    const { statut: code } = await appeler(proposeShift, commeAdherent(CAMILLE, { id: A_VENIR }));

    expect(code).toBe(201);
    expect(base.lignes).toHaveLength(1);
    expect(statut(A_VENIR, CAMILLE.id)).toBe('PENDING');
  });
});

describe('Accepter une proposition', () => {
  it('confirme la place et prévient l\'adhérent', async () => {
    base.lignes = [ligne(A_VENIR, CAMILLE.id, 'PENDING')];

    const { statut: code } = await appeler(acceptProposal, commeAdmin({ shiftId: A_VENIR, userId: CAMILLE.id }));

    expect(code).toBe(200);
    expect(statut(A_VENIR, CAMILLE.id)).toBe('CONFIRMED');
    expect(envois).toEqual([{ type: 'confirmation', email: CAMILLE.email, shiftId: A_VENIR }]);
    expect(journal[0].details).toEqual({ before: { status: 'PENDING' }, after: { status: 'CONFIRMED' } });
  });

  it('s\'arrête quand la permanence est déjà complète', async () => {
    base.shifts[0].volunteersNeeded = 1;
    base.lignes = [ligne(A_VENIR, ALEX.id, 'CONFIRMED'), ligne(A_VENIR, CAMILLE.id, 'PENDING')];

    const { statut: code } = await appeler(acceptProposal, commeAdmin({ shiftId: A_VENIR, userId: CAMILLE.id }));

    expect(code).toBe(409);
    expect(statut(A_VENIR, CAMILLE.id)).toBe('PENDING');
    expect(envois).toHaveLength(0);
  });

  it('ne revient pas sur un refus', async () => {
    base.lignes = [ligne(A_VENIR, CAMILLE.id, 'REFUSED')];

    const { statut: code } = await appeler(acceptProposal, commeAdmin({ shiftId: A_VENIR, userId: CAMILLE.id }));

    expect(code).toBe(409);
    expect(statut(A_VENIR, CAMILLE.id)).toBe('REFUSED');
  });
});

describe('Refuser une proposition', () => {
  it('écarte la proposition et prévient l\'adhérent', async () => {
    base.lignes = [ligne(A_VENIR, CAMILLE.id, 'PENDING')];

    const { statut: code } = await appeler(refuseProposal, commeAdmin({ shiftId: A_VENIR, userId: CAMILLE.id }));

    expect(code).toBe(200);
    expect(statut(A_VENIR, CAMILLE.id)).toBe('REFUSED');
    expect(envois).toEqual([{ type: 'refus', email: CAMILLE.email, shiftId: A_VENIR }]);
    expect(journal[0].details).toEqual({ before: { status: 'PENDING' }, after: { status: 'REFUSED' } });
  });

  /* Lecture périmée : la ligne a été acceptée entre la lecture et l'écriture. */
  it('n\'écrase pas une acceptation arrivée entre-temps', async () => {
    base.lignes = [ligne(A_VENIR, CAMILLE.id, 'CONFIRMED')];
    vi.spyOn(prisma.shiftVolunteer, 'findUnique').mockResolvedValueOnce({
      ...ligne(A_VENIR, CAMILLE.id, 'PENDING'),
      shift: base.shifts[0],
      user: CAMILLE,
    });

    const { statut: code } = await appeler(refuseProposal, commeAdmin({ shiftId: A_VENIR, userId: CAMILLE.id }));

    expect(code).toBe(409);
    expect(statut(A_VENIR, CAMILLE.id)).toBe('CONFIRMED');
    expect(envois).toHaveLength(0);
  });
});

describe('Se retirer', () => {
  it('retire une proposition à tout moment, même à moins de 48 h', async () => {
    base.lignes = [ligne(DEMAIN, CAMILLE.id, 'PENDING')];

    const { statut: code, message } = await appeler(leaveShift, commeAdherent(CAMILLE, { id: DEMAIN }));

    expect(code).toBe(200);
    expect(message).toBe('Proposition retirée');
    expect(statut(DEMAIN, CAMILLE.id)).toBe('CANCELLED');
    expect(envois).toHaveLength(0);
  });

  it('prévient les admins quand une place confirmée se libère', async () => {
    base.lignes = [ligne(A_VENIR, CAMILLE.id, 'CONFIRMED'), ligne(A_VENIR, ALEX.id, 'CONFIRMED')];

    const { statut: code } = await appeler(leaveShift, commeAdherent(CAMILLE, { id: A_VENIR }));

    expect(code).toBe(200);
    expect(envois).toEqual([
      { type: 'desistement', email: CAMILLE.email, shiftId: A_VENIR },
      { type: 'avis', email: ADMIN.email, shiftId: A_VENIR, qui: CAMILLE.firstName, confirmedCount: 1 },
    ]);
  });

  it('ne prévient pas un admin de son propre désistement', async () => {
    const autreAdmin = { id: 'admin-2', email: 'sam@example.org', firstName: 'Sam', lastName: 'Roux', role: 'ADMIN', deletedAt: null };
    base.comptes.push(autreAdmin);
    base.lignes = [ligne(A_VENIR, ADMIN.id, 'CONFIRMED')];

    await appeler(leaveShift, commeAdherent(ADMIN, { id: A_VENIR }));

    expect(envois.filter((e) => e.type === 'avis').map((e) => e.email)).toEqual([autreAdmin.email]);
  });

  it('garde la règle des 48 h pour une place confirmée', async () => {
    base.lignes = [ligne(DEMAIN, CAMILLE.id, 'CONFIRMED')];

    const { statut: code } = await appeler(leaveShift, commeAdherent(CAMILLE, { id: DEMAIN }));

    expect(code).toBe(400);
    expect(statut(DEMAIN, CAMILLE.id)).toBe('CONFIRMED');
  });

  it('ne défait pas une acceptation arrivée entre-temps', async () => {
    base.lignes = [ligne(DEMAIN, CAMILLE.id, 'CONFIRMED')];
    vi.spyOn(prisma.shiftVolunteer, 'findUnique').mockResolvedValueOnce({
      ...ligne(DEMAIN, CAMILLE.id, 'PENDING'),
      shift: base.shifts[2],
      user: CAMILLE,
    });

    const { statut: code } = await appeler(leaveShift, commeAdherent(CAMILLE, { id: DEMAIN }));

    expect(code).toBe(409);
    expect(statut(DEMAIN, CAMILLE.id)).toBe('CONFIRMED');
  });
});

describe('Ce que voit un adhérent', () => {
  beforeEach(() => {
    base.shifts = [base.shifts[0]];
    base.lignes = [
      ligne(A_VENIR, ALEX.id, 'CONFIRMED'),
      ligne(A_VENIR, BEA.id, 'PENDING'),
      ligne(A_VENIR, DOMINIQUE.id, 'REFUSED'),
      ligne(A_VENIR, CAMILLE.id, 'PENDING'),
    ];
  });

  it('l\'équipe confirmée et sa propre ligne, jamais les propositions des autres', async () => {
    const { corps } = await appeler(getAllShifts, commeAdherent(CAMILLE));
    const [shift] = corps.data.shifts;

    expect(shift.volunteers.map((v) => v.userId).sort()).toEqual([ALEX.id, CAMILLE.id]);
    expect(shift.confirmedCount).toBe(1);
  });

  it('l\'admin voit toutes les lignes', async () => {
    const { corps } = await appeler(getAllShifts, commeAdmin());

    expect(corps.data.shifts[0].volunteers).toHaveLength(4);
  });
});

describe('Le formulaire de permanence de l\'admin', () => {
  beforeEach(() => {
    base.lignes = [ligne(A_VENIR, ALEX.id, 'CONFIRMED'), ligne(A_VENIR, BEA.id, 'PENDING')];
  });

  it('n\'efface pas une proposition absente de l\'équipe envoyée', async () => {
    const { statut: code } = await appeler(updateShift, commeAdmin({ id: A_VENIR }, { volunteers: [{ userId: ALEX.id }] }));

    expect(code).toBe(200);
    expect(statut(A_VENIR, BEA.id)).toBe('PENDING');
    expect(envois).toHaveLength(0);
  });

  it('fait d\'un placement direct une acceptation, annoncée par email', async () => {
    const { corps } = await appeler(updateShift, commeAdmin({ id: A_VENIR }, {
      volunteers: [{ userId: ALEX.id }, { userId: BEA.id }],
    }));

    expect(statut(A_VENIR, BEA.id)).toBe('CONFIRMED');
    expect(envois).toEqual([{ type: 'confirmation', email: BEA.email, shiftId: A_VENIR }]);
    expect(corps.notificationFailures).toBe(0);
  });

  it('annonce aussi un bénévole ajouté sans proposition', async () => {
    await appeler(updateShift, commeAdmin({ id: A_VENIR }, {
      volunteers: [{ userId: ALEX.id }, { userId: CAMILLE.id }],
    }));

    expect(statut(A_VENIR, CAMILLE.id)).toBe('CONFIRMED');
    expect(envois.map((e) => e.email)).toEqual([CAMILLE.email]);
  });
});

describe('Ce que l\'admin change dans l\'équipe ou le créneau', () => {
  beforeEach(() => {
    base.lignes = [ligne(A_VENIR, ALEX.id, 'CONFIRMED'), ligne(A_VENIR, BEA.id, 'PENDING')];
  });

  it('prévient le bénévole confirmé qu\'on retire de l\'équipe', async () => {
    const { corps } = await appeler(updateShift, commeAdmin({ id: A_VENIR }, { volunteers: [] }));

    expect(statut(A_VENIR, ALEX.id)).toBeUndefined();
    expect(envois).toEqual([{ type: 'retrait', email: ALEX.email, jour: '2026-10-14' }]);
    expect(corps.notificationFailures).toBe(0);
  });

  it('annonce le retrait à l\'ancienne date quand la permanence change aussi de jour', async () => {
    await appeler(updateShift, commeAdmin({ id: A_VENIR }, { distributionDate: '2026-10-21', volunteers: [] }));

    expect(envois.filter((e) => e.type === 'retrait')).toEqual([{ type: 'retrait', email: ALEX.email, jour: '2026-10-14' }]);
  });

  it('juge le retrait sur la date que la personne avait retenue, pas sur la nouvelle', async () => {
    await appeler(updateShift, commeAdmin({ id: A_VENIR }, { distributionDate: '2026-09-23', volunteers: [] }));

    expect(envois).toEqual([{ type: 'retrait', email: ALEX.email, jour: '2026-10-14' }]);
  });

  it('ne prévient pas d\'un retrait sur une permanence passée', async () => {
    base.lignes = [ligne(PASSEE, ALEX.id, 'CONFIRMED')];

    await appeler(updateShift, commeAdmin({ id: PASSEE }, { volunteers: [] }));

    expect(envois).toHaveLength(0);
  });

  it('ne prévient ni un désisté qu\'on efface, ni l\'admin qui se retire lui-même', async () => {
    base.lignes = [ligne(A_VENIR, ALEX.id, 'CANCELLED'), ligne(A_VENIR, ADMIN.id, 'CONFIRMED')];

    await appeler(updateShift, commeAdmin({ id: A_VENIR }, { volunteers: [] }));

    expect(base.lignes).toHaveLength(0);
    expect(envois).toHaveLength(0);
  });

  it('annonce un nouvel horaire à l\'équipe et aux propositions en attente', async () => {
    await appeler(updateShift, commeAdmin({ id: A_VENIR }, { startTime: '17:30', volunteers: [{ userId: ALEX.id }] }));

    expect(envois).toEqual([
      { type: 'deplacement', email: ALEX.email, pending: false, avant: '2026-10-14 18:15', apres: '2026-10-14 17:30' },
      { type: 'deplacement', email: BEA.email, pending: true, avant: '2026-10-14 18:15', apres: '2026-10-14 17:30' },
    ]);
  });

  it('annonce une nouvelle date', async () => {
    await appeler(updateShift, commeAdmin({ id: A_VENIR }, { distributionDate: '2026-10-21', volunteers: [{ userId: ALEX.id }] }));

    expect(envois.map((e) => [e.email, e.apres])).toEqual([
      [ALEX.email, '2026-10-21 18:15'],
      [BEA.email, '2026-10-21 18:15'],
    ]);
  });

  it('n\'envoie qu\'une confirmation à qui est placé en même temps que le créneau change', async () => {
    await appeler(updateShift, commeAdmin({ id: A_VENIR }, {
      startTime: '17:30',
      volunteers: [{ userId: ALEX.id }, { userId: BEA.id }],
    }));

    expect(envois.filter((e) => e.email === BEA.email)).toEqual([{ type: 'confirmation', email: BEA.email, shiftId: A_VENIR }]);
    expect(envois.filter((e) => e.email === ALEX.email).map((e) => e.type)).toEqual(['deplacement']);
  });

  it('n\'écrit ni à un désisté, ni à un compte fermé, ni à l\'admin auteur du changement', async () => {
    base.comptes = base.comptes.map((c) => (c.id === BEA.id ? { ...c, deletedAt: new Date('2026-10-01T00:00:00Z') } : c));
    base.lignes = [
      ligne(A_VENIR, ALEX.id, 'CANCELLED'),
      ligne(A_VENIR, BEA.id, 'CONFIRMED'),
      ligne(A_VENIR, ADMIN.id, 'CONFIRMED'),
    ];

    await appeler(updateShift, commeAdmin({ id: A_VENIR }, {
      endTime: '19:45',
      volunteers: [{ userId: ALEX.id }, { userId: BEA.id }, { userId: ADMIN.id }],
    }));

    expect(envois).toHaveLength(0);
  });

  it('ne dit rien quand seuls l\'effectif ou les consignes changent', async () => {
    await appeler(updateShift, commeAdmin({ id: A_VENIR }, {
      volunteersNeeded: 3,
      notes: 'Apporter les cagettes',
      volunteers: [{ userId: ALEX.id }],
    }));

    expect(envois).toHaveLength(0);
  });
});

describe('Les propositions en attente, côté admin', () => {
  it('liste les dates à venir avec les permanences tenues depuis janvier', async () => {
    base.lignes = [
      ligne(A_VENIR, CAMILLE.id, 'PENDING'),
      ligne(A_VENIR, ALEX.id, 'CONFIRMED'),
      ligne(PASSEE, CAMILLE.id, 'CONFIRMED'),
      ligne(PASSEE, BEA.id, 'PENDING'),
    ];

    const { corps } = await appeler(getPendingProposals, commeAdmin());

    expect(corps.data).toHaveLength(1);
    expect(corps.data[0]).toMatchObject({ userId: CAMILLE.id, shiftsDoneThisYear: 1, confirmedCount: 1 });
  });
});
