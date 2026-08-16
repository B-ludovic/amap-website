/* Les deux bords d'une pause.

   Une pause a une date de début et une date de fin, et les deux se franchissent
   sans personne devant l'écran. Ce qui se vérifie ici : le contrat s'arrête au
   bon moment — pas à la saisie —, il repart tout seul, et l'adhérent l'apprend
   des deux côtés. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';

const { base, messages } = vi.hoisted(() => ({
  base: { contrats: [] },
  messages: [],
}));

vi.mock('../../src/services/email.service.js', () => ({
  default: {
    sendSubscriptionPaused: async (subscription, user, details) => {
      messages.push({ type: 'pause', id: subscription.id, email: user.email, ...details });
      return { success: true };
    },
    sendSubscriptionResumed: async (subscription, user) => {
      messages.push({ type: 'reprise', id: subscription.id, email: user.email });
      return { success: true };
    },
  },
}));

vi.mock('../../src/services/audit.service.js', () => ({ logAudit: async () => {} }));
vi.mock('../../src/services/contract.service.js', () => ({ default: {} }));

const trouver = (id) => base.contrats.find((c) => c.id === id);

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    subscription: {
      findUnique: async ({ where }) => {
        const contrat = trouver(where.id);
        return contrat ? { ...contrat } : null;
      },

      /* Les deux balayages du job, tels que Prisma les lit : une pause qui
         couvre l'instant présent d'un côté, une pause close et aucune en cours
         de l'autre. */
      findMany: async ({ where }) => base.contrats.filter((contrat) => {
        if (contrat.status !== where.status) return false;

        const { some, none } = where.pauses;

        if (some.startDate) {
          return contrat.pauses.some((p) => p.startDate <= some.startDate.lte && p.endDate >= some.endDate.gte);
        }

        return contrat.pauses.some((p) => p.endDate < some.endDate.lt)
          && !contrat.pauses.some((p) => p.endDate >= none.endDate.gte);
      }).map((contrat) => ({ ...contrat })),

      update: async ({ where, data }) => Object.assign(trouver(where.id), data),

      updateMany: async ({ where, data }) => {
        const contrat = trouver(where.id);
        if (!contrat || contrat.status !== where.status) return { count: 0 };

        Object.assign(contrat, data);
        return { count: 1 };
      },
    },

    subscriptionPause: {
      findMany: async ({ where }) => trouver(where.subscriptionId)?.pauses ?? [],
      create: async ({ data }) => {
        const pause = { id: `pause-${trouver(data.subscriptionId).pauses.length}`, ...data };
        trouver(data.subscriptionId).pauses.push(pause);
        return pause;
      },
    },
  },
}));

const { pauseSubscription, resumeSubscription } = await import('../../src/controllers/subscriptions.controller.js');
const { applyPauseTransitions } = await import('../../src/jobs/pauseResume.job.js');

const JOUR = 24 * 60 * 60 * 1000;
const ilYA = (jours) => new Date(Date.now() - jours * JOUR);
const dans = (jours) => new Date(Date.now() + jours * JOUR);
const jourISO = (date) => date.toISOString().slice(0, 10);

const contrat = (statut, pauses = []) => ({
  id: 'contrat-0001',
  subscriptionNumber: 'AMAP-2026-0142',
  status: statut,
  pauses,
  user: { id: 'user-0001', email: 'camille@example.org', firstName: 'Camille' },
  pickupLocation: { name: 'Salle des fêtes', address: '2 place de la Mairie, 45300 Yèvre-la-Ville' },
});

const mettreEnPause = (debut, fin) => appeler(pauseSubscription, {
  params: { id: 'contrat-0001' },
  body: { startDate: jourISO(debut), endDate: jourISO(fin) },
  user: { id: 'admin-0001' },
});

beforeEach(() => {
  messages.length = 0;
  base.contrats = [contrat('ACTIVE')];
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Une pause annoncée à l\'avance ne coupe pas les paniers d\'ici là', () => {
  it('laisse le contrat actif jusqu\'à la date de début', async () => {
    const { statut, message } = await mettreEnPause(dans(20), dans(27));

    expect(statut).toBe(200);
    expect(trouver('contrat-0001').status).toBe('ACTIVE');
    expect(message).toContain('prendra effet');
  });

  it('endort le contrat le jour venu, sans qu\'on le lui demande', async () => {
    await mettreEnPause(dans(20), dans(27));

    // Le calendrier avance : la pause couvre désormais l'instant présent.
    trouver('contrat-0001').pauses[0].startDate = ilYA(1);

    await applyPauseTransitions();

    expect(trouver('contrat-0001').status).toBe('PAUSED');
  });

  it('bascule tout de suite quand la pause commence le jour même', async () => {
    const { message } = await mettreEnPause(ilYA(0), dans(7));

    expect(trouver('contrat-0001').status).toBe('PAUSED');
    expect(message).toBe('Abonnement mis en pause avec succès');
  });
});

describe('L\'adhérente garde une trace écrite de sa pause', () => {
  it('reçoit les dates et ce qu\'il lui reste de quota', async () => {
    await mettreEnPause(dans(3), dans(10));

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ type: 'pause', email: 'camille@example.org', joursRestants: 7 });
  });

  it('voit son quota fondre à la seconde pause', async () => {
    await mettreEnPause(dans(3), dans(10));
    await mettreEnPause(dans(30), dans(37));

    expect(messages[1].joursRestants).toBe(0);
  });
});

describe('La reprise se dit, sans quoi un panier attend personne', () => {
  it('prévient à la fin de la pause', async () => {
    base.contrats = [contrat('PAUSED', [{ startDate: ilYA(8), endDate: ilYA(1) }])];

    await applyPauseTransitions();

    expect(trouver('contrat-0001').status).toBe('ACTIVE');
    expect(messages).toEqual([{ type: 'reprise', id: 'contrat-0001', email: 'camille@example.org' }]);
  });

  it('prévient aussi lors d\'une reprise anticipée par l\'administration', async () => {
    base.contrats = [contrat('PAUSED', [{ startDate: ilYA(1), endDate: dans(6) }])];

    const { statut } = await appeler(resumeSubscription, { params: { id: 'contrat-0001' }, user: { id: 'admin-0001' } });

    expect(statut).toBe(200);
    expect(messages[0].type).toBe('reprise');
  });

  /* Le balayage et l'administration peuvent viser le même contrat à la même
     seconde. C'est la base qui tranche, et le perdant n'écrit pas un second
     message pour une reprise déjà annoncée. */
  it('n\'écrit qu\'une fois quand la reprise a déjà eu lieu', async () => {
    base.contrats = [contrat('PAUSED', [{ startDate: ilYA(8), endDate: ilYA(1) }])];

    await appeler(resumeSubscription, { params: { id: 'contrat-0001' }, user: { id: 'admin-0001' } });
    await applyPauseTransitions();

    expect(messages.filter((m) => m.type === 'reprise')).toHaveLength(1);
  });

  it('laisse en pause un contrat dont une seconde pause court encore', async () => {
    base.contrats = [contrat('PAUSED', [
      { startDate: ilYA(8), endDate: ilYA(1) },
      { startDate: dans(2), endDate: dans(9) },
    ])];

    await applyPauseTransitions();

    expect(trouver('contrat-0001').status).toBe('PAUSED');
    expect(messages).toHaveLength(0);
  });
});
