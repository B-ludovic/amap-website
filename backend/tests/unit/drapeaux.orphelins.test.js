/* Balayage des drapeaux d'envoi orphelins — défaut m9.

   Un processus mort entre la prise du drapeau et son relâchement le laisse levé
   pour toujours. Ce que ces tests protègent surtout, c'est le sens inverse : ne
   PAS relâcher un drapeau dont l'envoi a réussi, ce qui enverrait un doublon. */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { base } = vi.hoisted(() => ({ base: {} }));

/* Une base en mémoire, réduite à ce que le balayage interroge. Les filtres de
   date sont interprétés pour de vrai : c'est la fenêtre de sursis qu'on veut
   éprouver, pas un simple aller-retour de mock. */
vi.mock('../../src/config/database.js', () => {
  const dansLIntervalle = (valeur, filtre) => {
    if (!valeur) return false;
    if (filtre.lte && valeur > filtre.lte) return false;
    if (filtre.gte && valeur < filtre.gte) return false;

    return true;
  };

  const filtrerParDrapeau = (lignes, champ, filtre) =>
    lignes.filter((ligne) => dansLIntervalle(ligne[champ], filtre));

  return {
    prisma: {
      subscription: {
        findMany: async ({ where }) => filtrerParDrapeau(base.subscriptions, 'renewalReminderSentAt', where.renewalReminderSentAt).map(({ id }) => ({ id })),
        updateMany: async ({ where, data }) => {
          const cibles = base.subscriptions.filter((s) => where.id.in.includes(s.id) && s.renewalReminderSentAt !== null);
          cibles.forEach((s) => Object.assign(s, data));
          return { count: cibles.length };
        },
      },
      payment: {
        findMany: async ({ where }) => filtrerParDrapeau(base.payments, 'reminderSentAt', where.reminderSentAt).map(({ id }) => ({ id })),
        updateMany: async ({ where, data }) => {
          const cibles = base.payments.filter((p) => where.id.in.includes(p.id) && p.reminderSentAt !== null);
          cibles.forEach((p) => Object.assign(p, data));
          return { count: cibles.length };
        },
      },
      newsletter: {
        findMany: async ({ where }) => base.newsletters
          .filter((n) => n.status === where.status && dansLIntervalle(n.sentAt, where.sentAt))
          .map(({ id, subject }) => ({ id, subject })),
        update: async ({ where, data }) => {
          const cible = base.newsletters.find((n) => n.id === where.id);
          Object.assign(cible, data);
          return cible;
        },
      },
      emailLog: {
        findMany: async ({ where }) => {
          const refs = new Set(base.emailLogs
            .filter((l) => l.kind === where.kind && l.status === where.status && where.ref.in.includes(l.ref))
            .map((l) => l.ref));

          return [...refs].map((ref) => ({ ref }));
        },
        count: async ({ where }) => base.emailLogs
          .filter((l) => l.kind === where.kind && l.status === where.status && l.ref === where.ref).length,
      },
    },
  };
});

const { releaseOrphanFlags } = await import('../../src/jobs/orphanFlags.job.js');

const ilYA = (ms) => new Date(Date.now() - ms);
const MINUTES = 60 * 1000;
const HEURES = 60 * MINUTES;
const JOURS = 24 * HEURES;

function poserBase({ subscriptions = [], payments = [], newsletters = [], emailLogs = [] } = {}) {
  base.subscriptions = subscriptions;
  base.payments = payments;
  base.newsletters = newsletters;
  base.emailLogs = emailLogs;
}

let journal;

beforeEach(() => {
  journal = [];
  vi.spyOn(console, 'warn').mockImplementation((...a) => journal.push(a.join(' ')));
  vi.spyOn(console, 'error').mockImplementation((...a) => journal.push(a.join(' ')));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Un drapeau levé sur un envoi qui n\'a jamais eu lieu retombe', () => {
  it('relâche un rappel de renouvellement sans trace d\'envoi', async () => {
    poserBase({
      subscriptions: [{ id: 'contrat-1', renewalReminderSentAt: ilYA(3 * HEURES) }],
    });

    await releaseOrphanFlags();

    expect(base.subscriptions[0].renewalReminderSentAt).toBeNull();
    expect(journal.join('\n')).toContain('rappel(s) de renouvellement relâché(s)');
  });

  it('relâche un avis de chèque sans trace d\'envoi', async () => {
    poserBase({
      payments: [{ id: 'cheque-1', reminderSentAt: ilYA(3 * HEURES) }],
    });

    await releaseOrphanFlags();

    expect(base.payments[0].reminderSentAt).toBeNull();
  });

  it('relâche aussi quand la trace existe mais dit FAILED', async () => {
    poserBase({
      subscriptions: [{ id: 'contrat-1', renewalReminderSentAt: ilYA(3 * HEURES) }],
      emailLogs: [{ kind: 'RENEWAL_REMINDER', status: 'FAILED', ref: 'contrat-1' }],
    });

    await releaseOrphanFlags();

    /* Une ligne FAILED atteste d'une tentative, pas d'un message reçu. Le
       processus est mort juste après le refus, avant de relâcher lui-même. */
    expect(base.subscriptions[0].renewalReminderSentAt).toBeNull();
  });
});

describe('Un drapeau levé sur un envoi bien parti ne bouge pas', () => {
  it('laisse tranquille un rappel dont la trace dit SENT', async () => {
    const pose = ilYA(3 * HEURES);
    poserBase({
      subscriptions: [{ id: 'contrat-1', renewalReminderSentAt: pose }],
      emailLogs: [{ kind: 'RENEWAL_REMINDER', status: 'SENT', ref: 'contrat-1' }],
    });

    await releaseOrphanFlags();

    /* Le relâcher réexpédierait un rappel déjà reçu — l'erreur exactement
       inverse de celle qu'on répare, et la plus coûteuse des deux. */
    expect(base.subscriptions[0].renewalReminderSentAt).toBe(pose);
  });

  it('ne confond pas les types d\'envoi entre eux', async () => {
    const pose = ilYA(3 * HEURES);
    poserBase({
      subscriptions: [{ id: 'objet-1', renewalReminderSentAt: pose }],
      payments: [{ id: 'objet-1', reminderSentAt: pose }],
      /* Même identifiant, mais un seul des deux messages est parti. */
      emailLogs: [{ kind: 'RENEWAL_REMINDER', status: 'SENT', ref: 'objet-1' }],
    });

    await releaseOrphanFlags();

    expect(base.subscriptions[0].renewalReminderSentAt).toBe(pose);
    expect(base.payments[0].reminderSentAt).toBeNull();
  });
});

describe('La fenêtre de sursis', () => {
  it('épargne un envoi en cours depuis dix minutes', async () => {
    const pose = ilYA(10 * MINUTES);
    poserBase({ subscriptions: [{ id: 'contrat-1', renewalReminderSentAt: pose }] });

    await releaseOrphanFlags();

    /* Le job tourne peut-être en ce moment même : une heure de sursis, très
       au-delà du plus long envoi du projet. */
    expect(base.subscriptions[0].renewalReminderSentAt).toBe(pose);
  });

  it('épargne un drapeau plus vieux que la rétention d\'EmailLog', async () => {
    const pose = ilYA(30 * JOURS);
    poserBase({ subscriptions: [{ id: 'contrat-1', renewalReminderSentAt: pose }] });

    await releaseOrphanFlags();

    /* Passé la fenêtre, une trace absente ne prouve plus rien : elle a pu être
       purgée. Relâcher ici réexpédierait un rappel vieux d'un mois. */
    expect(base.subscriptions[0].renewalReminderSentAt).toBe(pose);
  });
});

describe('Une newsletter bloquée en cours d\'envoi', () => {
  it('redevient renvoyable si personne n\'a rien reçu', async () => {
    poserBase({
      newsletters: [{ id: 'lettre-1', subject: 'Rentrée', status: 'SENDING', sentAt: ilYA(3 * HEURES), sentCount: 0 }],
    });

    await releaseOrphanFlags();

    expect(base.newsletters[0]).toMatchObject({ status: 'FAILED', sentAt: null, sentCount: 0 });
    expect(journal.join('\n')).toContain('de nouveau renvoyable');
  });

  it('se close sur le compte réel si la diffusion s\'est interrompue en route', async () => {
    poserBase({
      newsletters: [{ id: 'lettre-1', subject: 'Rentrée', status: 'SENDING', sentAt: ilYA(3 * HEURES), sentCount: 0 }],
      emailLogs: [
        { kind: 'NEWSLETTER', status: 'SENT', ref: 'lettre-1' },
        { kind: 'NEWSLETTER', status: 'SENT', ref: 'lettre-1' },
        { kind: 'NEWSLETTER', status: 'FAILED', ref: 'lettre-1' },
      ],
    });

    await releaseOrphanFlags();

    /* Deux adhérents ont reçu la lettre : la renvoyer leur écrirait deux fois.
       Elle est donc close, sur le compte qu'EmailLog a mémorisé — plus fiable
       que le compteur figé au moment de la panne. */
    expect(base.newsletters[0]).toMatchObject({ status: 'SENT', sentCount: 2 });
    expect(base.newsletters[0].sentAt).not.toBeNull();
  });

  it('laisse tourner une diffusion partie il y a dix minutes', async () => {
    poserBase({
      newsletters: [{ id: 'lettre-1', subject: 'Rentrée', status: 'SENDING', sentAt: ilYA(10 * MINUTES), sentCount: 40 }],
    });

    await releaseOrphanFlags();

    expect(base.newsletters[0].status).toBe('SENDING');
  });
});

describe('Le balayage ne fait pas tomber le démarrage du serveur', () => {
  it('avale une base injoignable et le dit', async () => {
    poserBase();
    base.subscriptions = null; // findMany lèvera

    await expect(releaseOrphanFlags()).resolves.toBeUndefined();
    expect(journal.join('\n')).toContain('[OrphanFlags] Erreur lors du balayage');
  });
});
