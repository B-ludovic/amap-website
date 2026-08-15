/* Le sort d'une newsletter au moment de l'envoi — défauts C3 et M2.

   Tout tient à un champ, sentAt, et à deux questions posées sur lui.

   Quand le poser (C3). L'association a dépassé son quota Brevo du jour.
   L'administratrice envoie la lettre de rentrée à cent vingt adhérents ; les
   cent vingt envois sont refusés. Avant, le service rendait { success: true } —
   son try externe n'englobait aucun appel réseau — le contrôleur posait sentAt
   sans regarder le compte, et l'écran affichait « Newsletter envoyée à 0
   destinataire(s) ». Second clic : « cette newsletter a déjà été envoyée ». Le
   texte mourait en base, lu par personne.

   Quand le poser, dans le temps (M2). Le contrôle de sentAt se faisait à la
   lecture, l'écriture venait après la boucle : entre les deux, deux à trois
   minutes pour deux cents adhérents. Le proxy de l'hébergeur coupe la connexion
   au bout de deux minutes, l'administratrice croit que rien n'est parti et
   reclique. Le premier envoi tournait toujours, et cent trente personnes
   recevaient la lettre en double.

   Ces tests portent donc moins sur des messages d'erreur que sur une décision
   d'écriture : poser le drapeau, le relâcher, ou refuser d'entrer. La base
   factice ci-dessous arbitre comme le ferait Postgres, sans quoi le
   compare-and-set ne serait pas réellement éprouvé.

   Le même piège existait dans l'annonce automatique de fermeture, qui passe par
   le même service ; il est éprouvé ici aussi. */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';

const { scenario, etat, closuresCreees } = vi.hoisted(() => ({
  scenario: {},
  etat: { lettre: null, annonce: null },
  closuresCreees: [],
}));

vi.mock('../../src/services/email.service.js', () => ({
  default: {
    sendNewsletter: async () => {
      /* Une porte que le test peut tenir fermée, pour garder un envoi « en
         cours » pendant qu'un second clic arrive. */
      if (scenario.porte) await scenario.porte;

      return { success: scenario.success, results: scenario.results };
    },
  },
}));

vi.mock('../../src/services/newsletterAudience.service.js', () => ({
  resolveNewsletterRecipients: async () => {
    /* Seconde porte, posée entre la lecture de sentAt et la prise du drapeau.
       C'est la seule fenêtre où deux requêtes peuvent se croiser en ayant
       toutes deux vu le champ à null — donc le seul endroit d'où l'on peut
       éprouver le compare-and-set lui-même. */
    if (scenario.porteDestinataires) await scenario.porteDestinataires;

    return scenario.destinataires;
  },
  overridesOptOut: (type) => type === 'ALERT',
}));

vi.mock('../../src/services/audit.service.js', () => ({ logAudit: async () => {} }));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    newsletter: {
      findUnique: async () => etat.lettre,

      create: async ({ data }) => {
        etat.annonce = { id: 'newsletter-annonce', sentAt: null, sentCount: 0, ...data };
        return etat.annonce;
      },

      update: async ({ where, data }) => {
        const cible = where.id === etat.lettre?.id ? etat.lettre : etat.annonce;
        Object.assign(cible, data);
        return cible;
      },

      /* Le cœur de M2 : l'écriture n'est acceptée que si le drapeau est encore
         nul au moment où elle s'exécute. C'est ce que fait un UPDATE … WHERE
         sentAt IS NULL, et c'est ce qui permet à la base d'arbitrer entre deux
         requêtes plutôt que de laisser l'application le faire. */
      updateMany: async ({ where, data }) => {
        const cible = etat.lettre;

        if (where.sentAt === null && cible.sentAt !== null) return { count: 0 };

        Object.assign(cible, data);
        return { count: 1 };
      },
    },

    /* Le chemin de création d'une fermeture passe par trois gardes avant
       d'arriver à l'annonce : chevauchement d'une autre fermeture, quota de
       trois semaines par an, permanences déjà planifiées. Elles ne sont pas le
       sujet ici — on leur donne un terrain vide pour qu'elles laissent passer. */
    amapClosure: {
      create: async ({ data }) => { const c = { id: 'fermeture-0001', ...data }; closuresCreees.push(c); return c; },
      findFirst: async () => null,
      findMany: async () => [],
    },
    shift: { findMany: async () => [] },
  },
}));

const { sendNewsletter } = await import('../../src/controllers/newsletters.controller.js');
const { createClosure } = await import('../../src/controllers/closures.controller.js');

const requete = {
  params: { id: 'newsletter-0001' },
  user: { id: 'admin-0001', email: 'admin@example.org', firstName: 'Sofia' },
};

/* Cent vingt adhérents pour la scène de C3, deux cents pour celle de M2. */
const adherents = (nombre) => Array.from({ length: nombre }, (_, i) => ({
  id: `u${i}`, email: `adherent${i}@example.org`, firstName: 'Adhérent',
}));

const CENT_VINGT = adherents(120);

function poserScenario({ sent, failed, destinataires = CENT_VINGT, success = true }) {
  scenario.success = success;
  scenario.porte = null;
  scenario.porteDestinataires = null;
  scenario.destinataires = destinataires;
  scenario.results = {
    sent,
    failed,
    errors: destinataires.slice(0, failed).map((d) => ({ email: d.email, error: 'quota exceeded' })),
  };

  etat.lettre = {
    id: 'newsletter-0001',
    subject: 'La lettre de rentrée',
    target: 'ALL',
    type: 'NEWSLETTER',
    sentAt: null,
    sentCount: 0,
  };
  etat.annonce = null;
}

let journal;

beforeEach(() => {
  closuresCreees.length = 0;
  journal = [];
  vi.spyOn(console, 'error').mockImplementation((...a) => journal.push(a.join(' ')));
  vi.spyOn(console, 'warn').mockImplementation((...a) => journal.push(a.join(' ')));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Une newsletter que personne n\'a reçue ne se verrouille pas', () => {
  it('refuse l\'envoi et relâche le drapeau', async () => {
    poserScenario({ sent: 0, failed: 120 });

    const { statut, message } = await appeler(sendNewsletter, requete);

    expect(statut).toBe(400);
    expect(message).toContain('Aucun email n\'a pu être envoyé');
    expect(message).toContain('120 échecs');
    /* Le cœur du défaut : c'est ce champ resté nul qui garde la newsletter
       renvoyable. */
    expect(etat.lettre.sentAt).toBeNull();
  });

  it('annonce que le texte reste modifiable, plutôt que de laisser deviner', async () => {
    poserScenario({ sent: 0, failed: 120 });

    const { message } = await appeler(sendNewsletter, requete);

    expect(message).toContain('reste modifiable et renvoyable');
  });

  it('journalise l\'échec sans recopier une seule adresse', async () => {
    poserScenario({ sent: 0, failed: 120 });

    await appeler(sendNewsletter, requete);

    const trace = journal.join('\n');
    expect(trace).toContain('échec total');
    expect(trace).toContain('120');
    /* Même règle que pour error.middleware.js : le détail par destinataire vit
       dans EmailLog, pas dans les logs de l'hébergeur. */
    expect(trace).not.toContain('@example.org');
    expect(trace).toContain('EmailLog');
  });

  it('reste renvoyable pour de bon : un second essai repart', async () => {
    poserScenario({ sent: 0, failed: 120 });
    await appeler(sendNewsletter, requete);

    /* Le quota est revenu. */
    poserScenario({ sent: 120, failed: 0 });
    etat.lettre.sentAt = null;

    const { statut } = await appeler(sendNewsletter, requete);

    expect(statut).toBe(200);
    expect(etat.lettre.sentAt).toBeInstanceOf(Date);
    expect(etat.lettre.sentCount).toBe(120);
  });
});

describe('Un envoi partiel se verrouille, mais le dit', () => {
  it('garde le drapeau et enregistre le nombre réellement atteint', async () => {
    poserScenario({ sent: 118, failed: 2 });

    const { statut, corps } = await appeler(sendNewsletter, requete);

    expect(statut).toBe(200);
    expect(etat.lettre.sentAt).toBeInstanceOf(Date);
    expect(etat.lettre.sentCount).toBe(118);
    expect(corps.data).toEqual({ sentCount: 118, failedCount: 2 });
  });

  it('nomme les non-joints dans le message rendu à l\'écran', async () => {
    poserScenario({ sent: 118, failed: 2 });

    const { message } = await appeler(sendNewsletter, requete);

    expect(message).toBe('Newsletter envoyée à 118 destinataire(s), 2 non joint(s).');
  });
});

describe('Un envoi qui se passe bien ne change pas de comportement', () => {
  it('pose le drapeau et rend le message habituel', async () => {
    poserScenario({ sent: 120, failed: 0 });

    const { statut, message } = await appeler(sendNewsletter, requete);

    expect(statut).toBe(200);
    expect(message).toBe('Newsletter envoyée à 120 destinataire(s)');
    expect(etat.lettre.sentCount).toBe(120);
  });
});

describe('Une liste vide n\'est pas un échec', () => {
  it('marque la newsletter envoyée sans lever d\'erreur', async () => {
    poserScenario({ sent: 0, failed: 0, destinataires: [] });

    const { statut, erreur } = await appeler(sendNewsletter, requete);

    /* Zéro destinataire, zéro refus : il n'y avait personne à qui écrire, ce
       qui n'est pas la même chose qu'un envoi refusé. Le garde-fou ne se
       déclenche donc pas. */
    expect(erreur).toBeNull();
    expect(statut).toBe(200);
    expect(etat.lettre.sentAt).toBeInstanceOf(Date);
  });
});

describe('Le service qui s\'effondre reste distinct du serveur qui refuse', () => {
  it('rend l\'erreur générique et relâche le drapeau', async () => {
    poserScenario({ sent: 0, failed: 0 });
    scenario.success = false;

    const { statut, message } = await appeler(sendNewsletter, requete);

    expect(statut).toBe(400);
    expect(message).toBe('Erreur lors de l\'envoi de la newsletter');
    expect(etat.lettre.sentAt).toBeNull();
  });
});

describe('Le second clic pendant que le premier envoi tourne', () => {
  it('est refusé, et personne ne reçoit la lettre en double', async () => {
    poserScenario({ sent: 200, failed: 0, destinataires: adherents(200) });

    /* On tient l'envoi ouvert : côté serveur la boucle tourne encore, comme
       pendant les deux minutes qui précèdent la coupure du proxy. */
    let ouvrirLaPorte;
    scenario.porte = new Promise((resolve) => { ouvrirLaPorte = resolve; });

    const premierClic = appeler(sendNewsletter, requete);
    await new Promise((resolve) => setImmediate(resolve));

    /* L'administratrice, qui a vu une erreur réseau, reclique. */
    const secondClic = await appeler(sendNewsletter, requete);

    expect(secondClic.statut).toBe(409);
    expect(secondClic.message).toBe('Cette newsletter a déjà été envoyée');

    ouvrirLaPorte();
    const resultatPremier = await premierClic;

    /* Le premier envoi, lui, va au bout et rend son compte. */
    expect(resultatPremier.statut).toBe(200);
    expect(etat.lettre.sentCount).toBe(200);
  });

  it('pose le drapeau avant l\'envoi, pas après', async () => {
    poserScenario({ sent: 200, failed: 0, destinataires: adherents(200) });

    let ouvrirLaPorte;
    scenario.porte = new Promise((resolve) => { ouvrirLaPorte = resolve; });

    const envoi = appeler(sendNewsletter, requete);
    await new Promise((resolve) => setImmediate(resolve));

    /* C'est toute la différence avec l'ancien code : à cet instant précis, la
       boucle n'a encore rien envoyé et le drapeau est déjà posé. */
    expect(etat.lettre.sentAt).toBeInstanceOf(Date);

    ouvrirLaPorte();
    await envoi;
  });
});

describe('Deux requêtes qui se croisent avant que l\'une ait pris le drapeau', () => {
  it('n\'en laisse passer qu\'une, et c\'est la base qui tranche', async () => {
    poserScenario({ sent: 200, failed: 0, destinataires: adherents(200) });

    /* On arrête les deux requêtes entre la lecture de sentAt et la prise du
       drapeau. À cet instant, toutes deux ont vu le champ à null : c'est
       exactement la situation qu'un contrôle applicatif ne sait pas départager,
       et qu'un UPDATE … WHERE sentAt IS NULL règle tout seul. */
    let ouvrirLaPorte;
    scenario.porteDestinataires = new Promise((resolve) => { ouvrirLaPorte = resolve; });

    const premiere = appeler(sendNewsletter, requete);
    const seconde = appeler(sendNewsletter, requete);
    await new Promise((resolve) => setImmediate(resolve));

    expect(etat.lettre.sentAt).toBeNull();

    ouvrirLaPorte();
    const resultats = await Promise.all([premiere, seconde]);

    /* Une seule passe. Laquelle importe peu — ce qui compte est qu'il n'y en
       ait pas deux, sans quoi cent trente adhérents reçoivent la lettre en
       double. */
    expect(resultats.map((r) => r.statut).sort()).toEqual([200, 409]);
    expect(resultats.filter((r) => r.statut === 409)[0].message)
      .toBe('Cette newsletter a déjà été envoyée');
    expect(etat.lettre.sentCount).toBe(200);
  });
});

describe('L\'annonce de fermeture tombe dans le même piège, et en sort pareil', () => {
  const requeteFermeture = {
    body: { startDate: '2027-02-01', endDate: '2027-02-08', reason: 'Congés', notify: true },
    user: { id: 'admin-0001', email: 'admin@example.org' },
  };

  it('crée la fermeture mais ne verrouille pas l\'annonce que personne n\'a reçue', async () => {
    poserScenario({ sent: 0, failed: 120 });

    const { statut, message, corps } = await appeler(createClosure, requeteFermeture);

    /* La fermeture, elle, est un fait : la refuser parce qu'un email n'est pas
       parti serait annuler une décision de l'association pour une panne de
       quota. */
    expect(statut).toBe(200);
    expect(closuresCreees).toHaveLength(1);

    expect(etat.annonce.sentAt).toBeNull();
    expect(message).toContain('Aucun abonné n\'a pu être joint');
    expect(message).toContain('renvoyable depuis l\'écran Communication');
    expect(corps.data.failedCount).toBe(120);
  });

  it('verrouille l\'annonce dès qu\'un abonné a été joint', async () => {
    poserScenario({ sent: 3, failed: 117 });

    const { message } = await appeler(createClosure, requeteFermeture);

    expect(etat.annonce.sentAt).toBeInstanceOf(Date);
    expect(etat.annonce.sentCount).toBe(3);
    expect(message).toBe('Fermeture créée. Newsletter envoyée à 3 abonné(s), 117 non joint(s).');
  });
});
