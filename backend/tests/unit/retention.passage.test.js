/* Trace de passage du job de rétention.

   Les huit purges ne journalisent que sous « count > 0 ». Un registre muet ne
   disait donc pas si le job avait tourné sans rien trouver ou n'avait pas tourné
   du tout — deux situations indiscernables dont l'une est une panne. Ce que ces
   tests protègent, c'est la ligne de fin de passage, celle qui est écrite quoi
   qu'il arrive. */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { base } = vi.hoisted(() => ({ base: {} }));

/* Base en mémoire réduite à ce que le job appelle. Chaque opération renvoie le
   décompte posé dans `base`, ce qui permet d'éprouver aussi bien un passage à
   vide qu'un passage qui trouve quelque chose. */
vi.mock('../../src/config/database.js', () => {
  const efface = (table) => async () => ({ count: base[table] ?? 0 });

  return {
    prisma: {
      $transaction: async (operations) => {
        if (base.transactionThrows) throw new Error('transaction interrompue');

        return Promise.all(operations);
      },
      /* purgeUsersMatching ne retient que le décompte de la DERNIÈRE opération
         de sa transaction, celle qui supprime les comptes. Les autres lignes
         effacent des données liées et ne pèsent pas dans le résultat. */
      weeklyPickup: { deleteMany: efface('rien') },
      subscriptionPause: { deleteMany: efface('rien') },
      payment: { deleteMany: efface('rien') },
      subscription: { deleteMany: efface('rien') },
      subscriptionRequest: { deleteMany: efface('orphanRequests'), count: async () => 0 },
      newsletter: { updateMany: efface('rien') },
      recipe: { updateMany: efface('rien') },
      user: { deleteMany: efface('users') },
      contactMessage: { deleteMany: efface('contactMessages'), count: async () => 0 },
      producerInquiry: { deleteMany: efface('producerInquiries'), count: async () => 0 },
      emailLog: { deleteMany: efface('emailLogs') },
      emailSuppression: { deleteMany: efface('emailSuppressions') },
      auditLog: {
        deleteMany: async ({ where }) => {
          base.filtreAudit = where;
          return { count: base.auditLogs ?? 0 };
        },
      },
    },
  };
});

const { logAudit } = vi.hoisted(() => ({ logAudit: vi.fn() }));
vi.mock('../../src/services/audit.service.js', () => ({ logAudit }));

const { runRetentionJob } = await import('../../src/jobs/dataRetention.job.js');

// Les lignes écrites par le job, hors celles des purges individuelles.
const passages = () => logAudit.mock.calls.filter(([, action]) => action.startsWith('RETENTION_JOB'));

beforeEach(() => {
  logAudit.mockClear();
  Object.keys(base).forEach((k) => delete base[k]);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Un passage qui ne trouve rien laisse quand même une trace', () => {
  it('consigne le passage alors qu\'aucune purge n\'a rien supprimé', async () => {
    await runRetentionJob();

    const traces = passages();
    expect(traces).toHaveLength(1);

    const [, action, severity, target, details] = traces[0];
    expect(action).toBe('RETENTION_JOB_RUN');
    expect(severity).toBe('IMPORTANT');
    expect(target).toEqual({ type: 'JOB', label: 'Passage de rétention' });
    expect(details.total).toBe(0);
  });

  it('n\'écrit aucune ligne de purge quand il n\'y a rien à purger', async () => {
    await runRetentionJob();

    const purges = logAudit.mock.calls.filter(([, action]) => action === 'PURGE_USER_DATA');
    expect(purges).toHaveLength(0);
  });

  it('mesure la durée du passage', async () => {
    await runRetentionJob();

    expect(passages()[0][4].durationMs).toBeTypeOf('number');
    expect(passages()[0][4].durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe('Le décompte rapporté est celui des suppressions réelles', () => {
  it('additionne ce que chaque purge a supprimé', async () => {
    Object.assign(base, {
      users: 2,
      contactMessages: 5,
      producerInquiries: 1,
      orphanRequests: 3,
      emailLogs: 40,
      emailSuppressions: 4,
      auditLogs: 6,
    });

    await runRetentionJob();
    const details = passages()[0][4];

    // Les comptes passent deux fois : supprimés depuis 90 jours, puis non vérifiés.
    expect(details.deletedAccounts).toBe(2);
    expect(details.unverifiedAccounts).toBe(2);
    expect(details.contactMessages).toBe(5);
    expect(details.producerInquiries).toBe(1);
    expect(details.orphanSubscriptionRequests).toBe(3);
    expect(details.emailLogs).toBe(40);
    expect(details.emailSuppressions).toBe(4);
    expect(details.auditLogs).toBe(6);
    expect(details.total).toBe(63);
  });
});

describe('Le journal d\'audit a un terme', () => {
  it('efface les lignes de plus d\'un an, comptées depuis le geste', async () => {
    const ilYAUnAn = new Date();
    ilYAUnAn.setDate(ilYAUnAn.getDate() - 365);

    await runRetentionJob();

    expect(Object.keys(base.filtreAudit)).toEqual(['createdAt']);
    expect(Math.abs(base.filtreAudit.createdAt.lte - ilYAUnAn)).toBeLessThan(60 * 1000);
  });

  it('consigne sa propre purge, sans donnée personnelle', async () => {
    base.auditLogs = 6;

    await runRetentionJob();

    const purge = logAudit.mock.calls.find(([, action, , target]) => action === 'PURGE_USER_DATA' && target.type === 'AUDIT_LOG');
    expect(purge.slice(3)).toEqual([
      { type: 'AUDIT_LOG', label: 'Journal des actions sensibles' },
      { count: 6, retentionDays: 365 },
    ]);
  });
});

describe('Un passage interrompu se distingue d\'un passage à vide', () => {
  it('consigne l\'échec en CRITICAL plutôt que de se taire', async () => {
    base.transactionThrows = true;

    await expect(runRetentionJob()).rejects.toThrow();

    const traces = passages();
    expect(traces).toHaveLength(1);

    const [, action, severity, target, details] = traces[0];
    expect(action).toBe('RETENTION_JOB_FAILED');
    expect(severity).toBe('CRITICAL');
    expect(target).toEqual({ type: 'JOB', label: 'Passage de rétention interrompu' });
    expect(details.message).toBe('transaction interrompue');
  });

  it('rend l\'erreur au planificateur une fois l\'échec consigné', async () => {
    base.transactionThrows = true;

    await expect(runRetentionJob()).rejects.toThrow('transaction interrompue');
  });
});
