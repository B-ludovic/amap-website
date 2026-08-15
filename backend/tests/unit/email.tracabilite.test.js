/* Trace des envois — défaut C2.

   Chaque envoi, réussi ou raté, laisse une ligne relisible dans EmailLog. Sans
   elle, personne ne pouvait dire lesquels des quatre bénévoles avaient été
   prévenus de l'annulation d'une permanence. */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import {
  boiteDEnvoi,
  viderBoite,
  registreEmails,
  viderRegistre,
  tracesDe,
  simulerRefusSmtp,
  retablirSmtp,
  simulerPanneDeBase,
  reglagesTransporteur,
} from '../helpers/boiteDEnvoi.js';
import { messagesSortants } from '../fixtures/messagesSortants.js';
import { adherente, permanence, panierHebdomadaire, lettreDInformation } from '../fixtures/destinataires.js';

vi.mock('nodemailer', async () => (await import('../helpers/boiteDEnvoi.js')).fauxNodemailer);
vi.mock('../../src/config/database.js', async () => (await import('../helpers/boiteDEnvoi.js')).fausseBase);

const emails = (await import('../../src/services/email.service.js')).default;
const MESSAGES = messagesSortants(emails);

let erreursConsole;

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

beforeEach(() => {
  viderBoite();
  viderRegistre();
  retablirSmtp();
  simulerPanneDeBase(false);
  erreursConsole = [];
  vi.spyOn(console, 'error').mockImplementation((...args) => { erreursConsole.push(args.join(' ')); });
});

afterEach(() => {
  vi.mocked(console.error).mockRestore();
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('Un envoi réussi laisse une trace exploitable', () => {
  it.each(MESSAGES)('$nom', async ({ envoyer, kind }) => {
    await envoyer();

    expect(registreEmails).toHaveLength(1);

    const trace = registreEmails[0];
    expect(trace.kind).toBe(kind);
    expect(trace.status).toBe('SENT');
    expect(trace.to).toBe(boiteDEnvoi[0].to);
    expect(trace.subject).toBe(boiteDEnvoi[0].subject);
    expect(trace.messageId).toBe('message-de-test');
    expect(trace.error).toBeNull();
  });
});

describe('Un envoi refusé laisse une trace, et se fait entendre', () => {
  it.each(MESSAGES)('$nom', async ({ envoyer, kind }) => {
    simulerRefusSmtp();

    const resultat = await envoyer();

    /* Les envois de masse rendent un compte-rendu agrégé plutôt qu'un booléen :
       c'est leur contrat, et il ne change pas ici. */
    if (resultat.results) {
      expect(resultat.results.failed).toBe(1);
      expect(resultat.results.sent).toBe(0);
    } else {
      expect(resultat.success).toBe(false);
      expect(resultat.error).toContain('quota exceeded');
    }

    expect(tracesDe(kind)).toHaveLength(1);

    const trace = tracesDe(kind)[0];
    expect(trace.status).toBe('FAILED');
    expect(trace.error).toContain('quota exceeded');
    expect(trace.messageId).toBeNull();

    /* Le silence était la moitié du défaut : treize méthodes sur dix-neuf
       n'écrivaient rien du tout. */
    expect(erreursConsole.join('\n')).toContain(`[Email:${kind}]`);
  });
});

describe('La scène du mardi soir', () => {
  const benevoles = [
    { firstName: 'Awa', email: 'awa@example.org' },
    { firstName: 'Bruno', email: 'bruno@example.org' },
    { firstName: 'Chloé', email: 'chloe@example.org' },
    { firstName: 'Dimitri', email: 'dimitri@example.org' },
  ];

  it('permet de dire lesquels des quatre bénévoles ont été prévenus', async () => {
    const verdicts = [];

    for (const [rang, benevole] of benevoles.entries()) {
      /* Le quota tombe sur le deuxième message, puis tout repart : c'est le
         scénario de l'audit, et le plus embarrassant — un échec au milieu
         d'une liste, encadré de succès. */
      if (rang === 1) simulerRefusSmtp(); else retablirSmtp();

      verdicts.push(await emails.sendShiftCancellation(permanence, benevole));
    }

    expect(verdicts.map((v) => v.success)).toEqual([true, false, true, true]);

    /* La question que personne ne savait trancher, désormais lisible d'un
       coup d'œil — c'est l'équivalent du SELECT de l'audit. */
    const prevenus = registreEmails.filter((t) => t.status === 'SENT').map((t) => t.to);
    const oublies = registreEmails.filter((t) => t.status === 'FAILED').map((t) => t.to);

    expect(prevenus).toEqual(['awa@example.org', 'chloe@example.org', 'dimitri@example.org']);
    expect(oublies).toEqual(['bruno@example.org']);
  });

  it('rattache chaque trace à la permanence concernée', async () => {
    await emails.sendShiftCancellation(permanence, benevoles[0]);

    expect(registreEmails[0].ref).toBe(permanence.id);
  });
});

describe('Un envoi de masse ne s\'arrête pas au premier refus', () => {
  it('compte les échecs et continue la liste', async () => {
    const destinataires = benevolesDeMasse();

    /* Le refus vaut pour toute la série : on vérifie qu'aucun destinataire
       n'est sauté, pas qu'un seul échoue. */
    simulerRefusSmtp();

    const resultat = await emails.sendNewsletter(lettreDInformation, destinataires);

    expect(resultat.success).toBe(true);
    expect(resultat.results.failed).toBe(destinataires.length);
    expect(resultat.results.errors).toHaveLength(destinataires.length);
    expect(registreEmails).toHaveLength(destinataires.length);
    expect(registreEmails.every((t) => t.status === 'FAILED')).toBe(true);
  });

  it('laisse une trace par destinataire du panier de la semaine', async () => {
    const destinataires = benevolesDeMasse();

    await emails.sendWeeklyBasketNotification(panierHebdomadaire, destinataires);

    expect(tracesDe('WEEKLY_BASKET')).toHaveLength(destinataires.length);
    expect(tracesDe('WEEKLY_BASKET').map((t) => t.to)).toEqual(destinataires.map((d) => d.email));
  });

  function benevolesDeMasse() {
    return [
      { id: 'u1', firstName: 'Awa', email: 'awa@example.org' },
      { id: 'u2', firstName: 'Bruno', email: 'bruno@example.org' },
      { id: 'u3', firstName: 'Chloé', email: 'chloe@example.org' },
    ];
  }
});

describe('Le lien vers le relais est borné dans le temps', () => {
  /* Trois réglages faciles à perdre au fil d'une refonte, et dont l'absence ne
     se voit pas : tout continue de fonctionner, simplement moins bien et
     beaucoup plus longtemps. D'où ce garde-fou. */
  it('garde les connexions plutôt que d\'en rouvrir une par message', () => {
    expect(reglagesTransporteur.pool).toBe(true);
    expect(reglagesTransporteur.maxConnections).toBeGreaterThan(0);
    expect(reglagesTransporteur.maxMessages).toBeGreaterThan(0);
  });

  it('n\'attend pas dix minutes devant un socket muet', () => {
    /* Le défaut de nodemailer est de 600 000 ms. Un envoi bloqué immobilisait
       la boucle d'autant. */
    expect(reglagesTransporteur.socketTimeout).toBeLessThanOrEqual(30_000);
    expect(reglagesTransporteur.connectionTimeout).toBeLessThanOrEqual(30_000);
    expect(reglagesTransporteur.greetingTimeout).toBeLessThanOrEqual(30_000);
  });
});

describe('Le rapport de progression pendant un envoi de masse', () => {
  /* Cinquante et un destinataires : deux lots, donc deux rapports et une pause
     d'une seconde entre les deux. La pause est franchie par une horloge
     factice — l'attendre réellement rendrait la suite plus lente que tout le
     reste réuni, pour ne rien prouver de plus. */
  const CINQUANTE_ET_UN = Array.from({ length: 51 }, (_, i) => ({
    id: `u${i}`, firstName: 'Adhérent', email: `adherent${i}@example.org`,
  }));

  it('rend compte à la fin de chaque lot, pas seulement à la fin', async () => {
    const rapports = [];

    vi.useFakeTimers();
    try {
      const envoi = emails.sendNewsletter(lettreDInformation, CINQUANTE_ET_UN, {
        onProgress: ({ sent, failed }) => { rapports.push({ sent, failed }); },
      });

      await vi.advanceTimersByTimeAsync(5000);
      await envoi;
    } finally {
      vi.useRealTimers();
    }

    /* Le premier rapport tombe alors qu'il reste un adhérent à servir : c'est
       ce qui permet à l'écran de communication de montrer un envoi qui avance
       au lieu d'une roue qui tourne. */
    expect(rapports).toEqual([{ sent: 50, failed: 0 }, { sent: 51, failed: 0 }]);
  });

  it('n\'interrompt pas l\'envoi si le rapport échoue', async () => {
    const envoi = await emails.sendNewsletter(lettreDInformation, [adherente], {
      onProgress: () => { throw new Error('base injoignable'); },
    });

    /* Rendre compte ne doit jamais faire échouer ce dont on rend compte. */
    expect(envoi.success).toBe(true);
    expect(envoi.results.sent).toBe(1);
    expect(erreursConsole.join('\n')).toContain('progression non enregistrée');
  });
});

describe('La trace ne fait jamais tomber l\'envoi qu\'elle décrit', () => {
  it('rend l\'envoi pour réussi même si la base est injoignable', async () => {
    simulerPanneDeBase();

    const resultat = await emails.sendWelcomeEmail(adherente);

    /* Le message est bel et bien parti : le dire raté serait mentir, et faire
       remonter l'exception transformerait une base indisponible en erreur 500
       — voire, sur l'appel non attendu des paniers, en arrêt du processus. */
    expect(resultat.success).toBe(true);
    expect(boiteDEnvoi).toHaveLength(1);
    expect(registreEmails).toHaveLength(0);
    expect(erreursConsole.join('\n')).toContain('trace non enregistrée');
  });
});

describe('Les logs de production ne recopient pas les adresses', () => {
  const NODE_ENV = process.env.NODE_ENV;

  afterEach(() => { process.env.NODE_ENV = NODE_ENV; });

  it('remplace l\'adresse par un renvoi vers la base', async () => {
    process.env.NODE_ENV = 'production';
    simulerRefusSmtp();

    await emails.sendWelcomeEmail(adherente);

    const journal = erreursConsole.join('\n');
    expect(journal).not.toContain(adherente.email);
    expect(journal).toContain('[adresse en base]');
    /* Elle n'est pas perdue pour autant : la trace, elle, la porte. */
    expect(registreEmails[0].to).toBe(adherente.email);
  });

  it('la garde en développement, là où elle sert au diagnostic', async () => {
    process.env.NODE_ENV = 'test';
    simulerRefusSmtp();

    await emails.sendWelcomeEmail(adherente);

    expect(erreursConsole.join('\n')).toContain(adherente.email);
  });
});

describe('Le récapitulatif du trésorier sans destinataire configuré', () => {
  const TREASURER_EMAIL = process.env.TREASURER_EMAIL;

  afterEach(() => { process.env.TREASURER_EMAIL = TREASURER_EMAIL; });

  it('ne part pas, ne trace rien, mais le dit', async () => {
    delete process.env.TREASURER_EMAIL;

    const resultat = await emails.sendTreasurerChequeDigest([]);

    expect(resultat.success).toBe(false);
    expect(boiteDEnvoi).toHaveLength(0);
    expect(registreEmails).toHaveLength(0);
    expect(erreursConsole.join('\n')).toContain('TREASURER_EMAIL non configurée');
  });
});
