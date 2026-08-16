/* La clôture des contrats arrivés à leur terme.

   Le rappel envoyé un mois plus tôt annonce une clôture « automatique à
   l'échéance ». Ce qui se vérifie ici : elle a bien lieu, elle se dit, et elle
   n'écrit pas à ceux dont le contrat s'est achevé il y a une saison. */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { base, messages, audits } = vi.hoisted(() => ({
  base: { contrats: [] },
  messages: [],
  audits: [],
}));

vi.mock('../../src/services/email.service.js', () => ({
  default: {
    sendSubscriptionExpired: async (subscription, user) => {
      messages.push({ id: subscription.id, email: user.email });
      return { success: true };
    },
  },
}));

vi.mock('../../src/services/audit.service.js', () => ({
  logAudit: async (_req, action, _severite, cible, details) => {
    audits.push({ action, id: cible.id, ...details });
  },
}));

const trouver = (id) => base.contrats.find((c) => c.id === id);

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    subscription: {
      findMany: async ({ where }) => base.contrats
        .filter((c) => where.status.in.includes(c.status) && c.endDate < where.endDate.lt)
        .map((c) => ({ ...c })),

      updateMany: async ({ where, data }) => {
        const contrat = trouver(where.id);
        if (!contrat || !where.status.in.includes(contrat.status)) return { count: 0 };

        Object.assign(contrat, data);
        return { count: 1 };
      },
    },
  },
}));

const { expireEndedSubscriptions } = await import('../../src/jobs/subscriptionExpiry.job.js');

const JOUR = 24 * 60 * 60 * 1000;
const ilYA = (jours) => new Date(Date.now() - jours * JOUR);
const dans = (jours) => new Date(Date.now() + jours * JOUR);

const contrat = (statut, fin, id = 'contrat-0001') => ({
  id,
  subscriptionNumber: `AMAP-2026-${id.slice(-4)}`,
  status: statut,
  type: 'ANNUAL',
  endDate: fin,
  user: { id: 'user-0001', email: 'camille@example.org', firstName: 'Camille' },
});

beforeEach(() => {
  messages.length = 0;
  audits.length = 0;
  base.contrats = [];
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Un contrat arrivé à son terme se clôt', () => {
  it('passe en échu et le dit à l\'adhérente', async () => {
    base.contrats = [contrat('ACTIVE', ilYA(1))];

    await expireEndedSubscriptions();

    expect(trouver('contrat-0001').status).toBe('EXPIRED');
    expect(messages).toEqual([{ id: 'contrat-0001', email: 'camille@example.org' }]);
  });

  /* Sans quoi un contrat en pause à son échéance resterait en pause pour
     toujours, sans jamais reprendre ni se clore. */
  it('clôt aussi un contrat resté en pause', async () => {
    base.contrats = [contrat('PAUSED', ilYA(2))];

    await expireEndedSubscriptions();

    expect(trouver('contrat-0001').status).toBe('EXPIRED');
    expect(audits[0]).toMatchObject({ from: 'PAUSED', to: 'EXPIRED' });
  });

  it('laisse tranquille un contrat encore en cours', async () => {
    base.contrats = [contrat('ACTIVE', dans(60))];

    await expireEndedSubscriptions();

    expect(trouver('contrat-0001').status).toBe('ACTIVE');
    expect(messages).toHaveLength(0);
  });

  it('ne revient pas sur un contrat déjà annulé', async () => {
    base.contrats = [contrat('CANCELLED', ilYA(1))];

    await expireEndedSubscriptions();

    expect(trouver('contrat-0001').status).toBe('CANCELLED');
    expect(messages).toHaveLength(0);
  });
});

describe('La mise en service ne réveille pas les saisons passées', () => {
  /* Au premier démarrage, la base porte des contrats échus depuis des mois :
     les clore est juste, écrire à leurs titulaires ne l'est pas. */
  it('clôt en silence au-delà d\'une semaine de retard', async () => {
    base.contrats = [contrat('ACTIVE', ilYA(200))];

    await expireEndedSubscriptions();

    expect(trouver('contrat-0001').status).toBe('EXPIRED');
    expect(audits).toHaveLength(1);
    expect(messages).toHaveLength(0);
  });

  it('écrit encore pour une échéance de la semaine', async () => {
    base.contrats = [contrat('ACTIVE', ilYA(6))];

    await expireEndedSubscriptions();

    expect(messages).toHaveLength(1);
  });

  it('traite chaque contrat pour lui-même', async () => {
    base.contrats = [contrat('ACTIVE', ilYA(1), 'contrat-0001'), contrat('ACTIVE', ilYA(300), 'contrat-0002')];

    await expireEndedSubscriptions();

    expect(base.contrats.every((c) => c.status === 'EXPIRED')).toBe(true);
    expect(messages.map((m) => m.id)).toEqual(['contrat-0001']);
  });
});
