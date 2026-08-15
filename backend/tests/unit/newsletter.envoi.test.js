/* Sort d'une newsletter à l'envoi — défauts C3, M2 et M10.

   Tout tient à deux champs, `status` et `sentAt` : relâchés quand rien n'est
   parti (C3), pris avant la boucle par compare-and-set (M2), et la boucle
   tourne hors de la requête (M10).

   Conséquence : la réponse HTTP ne dit plus le résultat de l'envoi. Ce qui se
   vérifie, c'est l'état en base — d'où attendreQue. */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';
import { attendreQue } from '../helpers/attente.js';

const { scenario, etat, closuresCreees } = vi.hoisted(() => ({
  scenario: {},
  etat: { lettre: null, annonce: null },
  closuresCreees: [],
}));

vi.mock('../../src/services/email.service.js', () => ({
  default: {
    sendNewsletter: async (newsletter, recipients, options = {}) => {
      /* Une porte que le test peut tenir fermée, pour garder un envoi « en
         cours » aussi longtemps qu'il le faut. */
      if (scenario.porte) await scenario.porte;

      if (options.onProgress) await options.onProgress({ sent: scenario.results.sent, failed: scenario.results.failed });

      return { success: scenario.success, results: scenario.results };
    },
  },
}));

vi.mock('../../src/services/newsletterAudience.service.js', () => ({
  resolveNewsletterRecipients: async () => {
    /* Seconde porte, posée entre la lecture du statut et la réservation. C'est
       la seule fenêtre où deux requêtes peuvent se croiser en ayant toutes deux
       vu la newsletter disponible — donc le seul endroit d'où l'on peut
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
        etat.annonce = { id: 'newsletter-annonce', status: 'DRAFT', sentAt: null, sentCount: 0, ...data };
        return etat.annonce;
      },

      update: async ({ where, data }) => {
        const cible = where.id === etat.lettre?.id ? etat.lettre : etat.annonce;
        Object.assign(cible, data);
        return cible;
      },

      /* Le cœur de M2 : l'écriture n'est acceptée que si le statut est encore
         un statut de départ au moment où elle s'exécute. C'est ce que fait un
         UPDATE … WHERE status IN (…), et c'est ce qui permet à la base
         d'arbitrer entre deux requêtes plutôt que de laisser l'application le
         faire. */
      updateMany: async ({ where, data }) => {
        const cible = where.id === etat.lettre?.id ? etat.lettre : etat.annonce;

        if (where.status?.in && !where.status.in.includes(cible.status)) return { count: 0 };

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
    status: 'DRAFT',
    sentAt: null,
    sentCount: 0,
  };
  etat.annonce = null;
}

/* La diffusion est lancée sans être attendue : on observe l'état, comme le
   ferait l'écran en se rafraîchissant. */
const attendreFin = (row = () => etat.lettre) =>
  attendreQue(() => row() && row().status !== 'SENDING', { intitule: 'la fin de la diffusion' });

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

describe('L\'envoi ne bloque plus la requête', () => {
  it('répond 202 sans attendre la fin de la boucle', async () => {
    poserScenario({ sent: 200, failed: 0, destinataires: adherents(200) });

    /* L'envoi est tenu ouvert : côté serveur la boucle n'a rien terminé. */
    let ouvrirLaPorte;
    scenario.porte = new Promise((resolve) => { ouvrirLaPorte = resolve; });

    const { statut, message, corps } = await appeler(sendNewsletter, requete);

    /* C'est tout le défaut M10 : la réponse arrive alors que rien n'est encore
       parti, au lieu de faire patienter l'administratrice quatre minutes
       jusqu'à ce que le proxy coupe. */
    expect(statut).toBe(202);
    expect(etat.lettre.status).toBe('SENDING');
    expect(etat.lettre.sentCount).toBe(0);
    expect(message).toContain('Envoi lancé vers 200 destinataire(s)');
    expect(corps.data).toEqual({ status: 'SENDING', recipientsCount: 200 });

    ouvrirLaPorte();
    await attendreFin();
    expect(etat.lettre.status).toBe('SENT');
  });

  it('refuse un second départ tant que la diffusion tourne', async () => {
    poserScenario({ sent: 200, failed: 0, destinataires: adherents(200) });

    let ouvrirLaPorte;
    scenario.porte = new Promise((resolve) => { ouvrirLaPorte = resolve; });

    await appeler(sendNewsletter, requete);

    const secondClic = await appeler(sendNewsletter, requete);

    expect(secondClic.statut).toBe(409);
    expect(secondClic.message).toBe('Un envoi est déjà en cours pour cette newsletter');

    ouvrirLaPorte();
    await attendreFin();
  });

  it('fait avancer le compteur en base pendant la diffusion', async () => {
    poserScenario({ sent: 120, failed: 0 });

    await appeler(sendNewsletter, requete);
    await attendreFin();

    /* Le compte vient du rapporteur de progression, pas de la réponse HTTP :
       c'est lui que l'écran de communication relit. */
    expect(etat.lettre.sentCount).toBe(120);
  });
});

describe('Une newsletter que personne n\'a reçue ne se verrouille pas', () => {
  it('retombe en échec, drapeau relâché', async () => {
    poserScenario({ sent: 0, failed: 120 });

    const { statut } = await appeler(sendNewsletter, requete);
    await attendreFin();

    /* La requête, elle, a bien été acceptée : l'échec ne se découvre qu'après. */
    expect(statut).toBe(202);
    expect(etat.lettre.status).toBe('FAILED');
    expect(etat.lettre.sentAt).toBeNull();
    expect(etat.lettre.sentCount).toBe(0);
  });

  it('journalise l\'échec sans recopier une seule adresse', async () => {
    poserScenario({ sent: 0, failed: 120 });

    await appeler(sendNewsletter, requete);
    await attendreFin();

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
    await attendreFin();

    expect(etat.lettre.status).toBe('FAILED');

    /* Le quota est revenu. FAILED est un état de départ, pas une impasse. */
    scenario.results = { sent: 120, failed: 0, errors: [] };

    const { statut } = await appeler(sendNewsletter, requete);
    await attendreFin();

    expect(statut).toBe(202);
    expect(etat.lettre.status).toBe('SENT');
    expect(etat.lettre.sentCount).toBe(120);
  });
});

describe('Un envoi partiel se verrouille, mais le dit', () => {
  it('reste SENT avec le nombre réellement atteint', async () => {
    poserScenario({ sent: 118, failed: 2 });

    await appeler(sendNewsletter, requete);
    await attendreFin();

    expect(etat.lettre.status).toBe('SENT');
    expect(etat.lettre.sentAt).toBeInstanceOf(Date);
    expect(etat.lettre.sentCount).toBe(118);
    expect(journal.join('\n')).toContain('2 destinataire(s) non joint(s)');
  });
});

describe('Une liste vide n\'est pas un échec', () => {
  it('close la newsletter sans la marquer en échec', async () => {
    poserScenario({ sent: 0, failed: 0, destinataires: [] });

    const { statut, message } = await appeler(sendNewsletter, requete);
    await attendreFin();

    /* Zéro destinataire, zéro refus : il n'y avait personne à qui écrire, ce
       qui n'est pas la même chose qu'un envoi refusé. */
    expect(statut).toBe(202);
    expect(message).toBe('Aucun destinataire dans cette cible : rien ne sera envoyé.');
    expect(etat.lettre.status).toBe('SENT');
  });
});

describe('Le service qui s\'effondre reste distinct du serveur qui refuse', () => {
  it('relâche le drapeau et laisse la newsletter renvoyable', async () => {
    poserScenario({ sent: 0, failed: 0 });
    scenario.success = false;
    scenario.results = { sent: 0, failed: 0, errors: [] };

    await appeler(sendNewsletter, requete);
    await attendreFin();

    expect(etat.lettre.status).toBe('FAILED');
    expect(etat.lettre.sentAt).toBeNull();
  });
});

describe('Une newsletter déjà partie ne repart pas', () => {
  it('refuse un envoi sur une lettre close', async () => {
    poserScenario({ sent: 120, failed: 0 });
    await appeler(sendNewsletter, requete);
    await attendreFin();

    const { statut, message } = await appeler(sendNewsletter, requete);

    expect(statut).toBe(409);
    expect(message).toBe('Cette newsletter a déjà été envoyée');
  });
});

describe('Deux requêtes qui se croisent avant que l\'une ait réservé', () => {
  it('n\'en laisse passer qu\'une, et c\'est la base qui tranche', async () => {
    poserScenario({ sent: 200, failed: 0, destinataires: adherents(200) });

    /* On arrête les deux requêtes entre la lecture du statut et la réservation.
       À cet instant, toutes deux ont vu la newsletter disponible : c'est
       exactement la situation qu'un contrôle applicatif ne sait pas départager,
       et qu'un UPDATE … WHERE status IN (…) règle tout seul. */
    let ouvrirLaPorte;
    scenario.porteDestinataires = new Promise((resolve) => { ouvrirLaPorte = resolve; });

    const premiere = appeler(sendNewsletter, requete);
    const seconde = appeler(sendNewsletter, requete);
    await new Promise((resolve) => setImmediate(resolve));

    expect(etat.lettre.status).toBe('DRAFT');

    ouvrirLaPorte();
    const resultats = await Promise.all([premiere, seconde]);
    await attendreFin();

    /* Une seule passe. Laquelle importe peu — ce qui compte est qu'il n'y en
       ait pas deux, sans quoi cent trente adhérents reçoivent la lettre en
       double. */
    expect(resultats.map((r) => r.statut).sort()).toEqual([202, 409]);
    expect(etat.lettre.sentCount).toBe(200);
  });
});

describe('L\'annonce de fermeture suit exactement le même chemin', () => {
  const requeteFermeture = {
    body: { startDate: '2027-02-01', endDate: '2027-02-08', reason: 'Congés', notify: true },
    user: { id: 'admin-0001', email: 'admin@example.org' },
  };

  const attendreAnnonce = () => attendreFin(() => etat.annonce);

  it('rend la main aussitôt, sans attendre les deux cents envois', async () => {
    poserScenario({ sent: 200, failed: 0, destinataires: adherents(200) });

    let ouvrirLaPorte;
    scenario.porte = new Promise((resolve) => { ouvrirLaPorte = resolve; });

    const { statut, message } = await appeler(createClosure, requeteFermeture);

    expect(statut).toBe(200);
    expect(closuresCreees).toHaveLength(1);
    expect(etat.annonce.status).toBe('SENDING');
    expect(message).toContain('Annonce en cours d\'envoi vers 200 abonné(s)');

    ouvrirLaPorte();
    await attendreAnnonce();
    expect(etat.annonce.status).toBe('SENT');
  });

  it('crée la fermeture même si l\'annonce n\'atteint personne', async () => {
    poserScenario({ sent: 0, failed: 120 });

    const { statut } = await appeler(createClosure, requeteFermeture);
    await attendreAnnonce();

    /* La fermeture, elle, est un fait : la refuser parce qu'un email n'est pas
       parti serait annuler une décision de l'association pour une panne de
       quota. L'annonce, elle, reste renvoyable. */
    expect(statut).toBe(200);
    expect(closuresCreees).toHaveLength(1);
    expect(etat.annonce.status).toBe('FAILED');
    expect(etat.annonce.sentAt).toBeNull();
  });

  it('n\'annonce rien quand il n\'y a aucun abonné actif', async () => {
    poserScenario({ sent: 0, failed: 0, destinataires: [] });

    const { message } = await appeler(createClosure, requeteFermeture);

    expect(message).toBe('Fermeture créée. Aucun abonné actif : aucune annonce envoyée.');
    expect(etat.annonce.status).toBe('DRAFT');
  });
});
