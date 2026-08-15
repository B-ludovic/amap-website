/* Ce qu'une newsletter devient quand l'envoi se passe mal — défaut C3.

   La scène. L'association a dépassé son quota Brevo du jour. L'administratrice
   envoie la newsletter de rentrée à cent vingt adhérents ; les cent vingt
   envois sont refusés. Avant, le service rendait { success: true } — son try
   externe n'englobait aucun appel réseau, tous les refus étaient rattrapés plus
   bas — le contrôleur posait sentAt sans regarder le compte, et l'écran
   affichait « Newsletter envoyée à 0 destinataire(s) ». Second clic : « cette
   newsletter a déjà été envoyée ». Le texte mourait en base, lu par personne,
   et il fallait le recopier dans une nouvelle newsletter pour s'en sortir.

   Tout tient à un champ. sentAt est ce qui verrouille : tant qu'il est nul, la
   newsletter se corrige et se renvoie. Ces tests vérifient donc moins un message
   d'erreur qu'une décision d'écriture — poser ou ne pas poser ce champ, selon
   que quelque chose est réellement parti.

   Le même piège existait dans l'annonce automatique de fermeture, qui passe par
   le même service ; il est éprouvé ici aussi. */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';

/* Le résultat que le service d'emails rendra, réécrit par chaque test. */
const { scenario, misesAJour, closuresCreees } = vi.hoisted(() => ({
  scenario: { results: { sent: 0, failed: 0, errors: [] }, success: true },
  misesAJour: [],
  closuresCreees: [],
}));

vi.mock('../../src/services/email.service.js', () => ({
  default: {
    sendNewsletter: async () => ({ success: scenario.success, results: scenario.results }),
  },
}));

vi.mock('../../src/services/newsletterAudience.service.js', () => ({
  resolveNewsletterRecipients: async () => scenario.destinataires,
  overridesOptOut: (type) => type === 'ALERT',
}));

vi.mock('../../src/services/audit.service.js', () => ({ logAudit: async () => {} }));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    newsletter: {
      findUnique: async () => scenario.newsletter,
      create: async ({ data }) => ({ id: 'newsletter-annonce', ...data }),
      update: async (args) => { misesAJour.push(args); return args; },
    },
    /* Le chemin de création d'une fermeture passe par trois gardes avant
       d'arriver à l'annonce : chevauchement d'une autre fermeture, quota de
       trois semaines par an, permanences déjà planifiées. Elles ne sont pas le
       sujet ici — on leur donne un terrain vide pour qu'elles laissent passer,
       et le test porte alors sur ce qui suit. */
    amapClosure: {
      create: async ({ data }) => { const c = { id: 'fermeture-0001', ...data }; closuresCreees.push(c); return c; },
      findFirst: async () => null,
      findMany: async () => [],
    },
    shift: {
      findMany: async () => [],
    },
  },
}));

const { sendNewsletter } = await import('../../src/controllers/newsletters.controller.js');
const { createClosure } = await import('../../src/controllers/closures.controller.js');

const requete = {
  params: { id: 'newsletter-0001' },
  user: { id: 'admin-0001', email: 'admin@example.org', firstName: 'Sofia' },
};

/* Cent vingt adhérents, comme dans la scène. */
const cent_vingt_adherents = Array.from({ length: 120 }, (_, i) => ({
  id: `u${i}`, email: `adherent${i}@example.org`, firstName: 'Adhérent',
}));

function poserScenario({ sent, failed, destinataires = cent_vingt_adherents, success = true }) {
  scenario.success = success;
  scenario.destinataires = destinataires;
  scenario.results = {
    sent,
    failed,
    errors: destinataires.slice(0, failed).map((d) => ({ email: d.email, error: 'quota exceeded' })),
  };
  scenario.newsletter = {
    id: 'newsletter-0001',
    subject: 'La lettre de rentrée',
    target: 'ALL',
    type: 'NEWSLETTER',
    sentAt: null,
  };
}

let journal;

beforeEach(() => {
  misesAJour.length = 0;
  closuresCreees.length = 0;
  journal = [];
  vi.spyOn(console, 'error').mockImplementation((...a) => journal.push(a.join(' ')));
  vi.spyOn(console, 'warn').mockImplementation((...a) => journal.push(a.join(' ')));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Une newsletter que personne n\'a reçue ne se verrouille pas', () => {
  it('refuse l\'envoi et laisse sentAt intact', async () => {
    poserScenario({ sent: 0, failed: 120 });

    const { statut, message } = await appeler(sendNewsletter, requete);

    expect(statut).toBe(400);
    expect(message).toContain('Aucun email n\'a pu être envoyé');
    expect(message).toContain('120 échecs');
    /* Le cœur du défaut : c'est cette absence d'écriture qui garde la
       newsletter renvoyable. */
    expect(misesAJour).toHaveLength(0);
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
});

describe('Un envoi partiel se verrouille, mais le dit', () => {
  it('pose sentAt avec le nombre réellement atteint', async () => {
    poserScenario({ sent: 118, failed: 2 });

    const { statut, corps } = await appeler(sendNewsletter, requete);

    expect(statut).toBe(200);
    expect(misesAJour).toHaveLength(1);
    expect(misesAJour[0].data.sentCount).toBe(118);
    expect(misesAJour[0].data.sentAt).toBeInstanceOf(Date);
    expect(corps.data).toEqual({ sentCount: 118, failedCount: 2 });
  });

  it('nomme les non-joints dans le message rendu à l\'écran', async () => {
    poserScenario({ sent: 118, failed: 2 });

    const { message } = await appeler(sendNewsletter, requete);

    expect(message).toBe('Newsletter envoyée à 118 destinataire(s), 2 non joint(s).');
  });
});

describe('Un envoi qui se passe bien ne change pas de comportement', () => {
  it('pose sentAt et rend le message habituel', async () => {
    poserScenario({ sent: 120, failed: 0 });

    const { statut, message } = await appeler(sendNewsletter, requete);

    expect(statut).toBe(200);
    expect(message).toBe('Newsletter envoyée à 120 destinataire(s)');
    expect(misesAJour[0].data.sentCount).toBe(120);
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
    expect(misesAJour).toHaveLength(1);
  });
});

describe('Le service qui s\'effondre reste distinct du serveur qui refuse', () => {
  it('rend l\'erreur générique quand la méthode elle-même a échoué', async () => {
    poserScenario({ sent: 0, failed: 0 });
    scenario.success = false;

    const { statut, message } = await appeler(sendNewsletter, requete);

    expect(statut).toBe(400);
    expect(message).toBe('Erreur lors de l\'envoi de la newsletter');
    expect(misesAJour).toHaveLength(0);
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

    expect(misesAJour).toHaveLength(0);
    expect(message).toContain('Aucun abonné n\'a pu être joint');
    expect(message).toContain('renvoyable depuis l\'écran Communication');
    expect(corps.data.failedCount).toBe(120);
  });

  it('verrouille l\'annonce dès qu\'un abonné a été joint', async () => {
    poserScenario({ sent: 3, failed: 117 });

    const { message } = await appeler(createClosure, requeteFermeture);

    expect(misesAJour).toHaveLength(1);
    expect(misesAJour[0].data.sentCount).toBe(3);
    expect(message).toBe('Fermeture créée. Newsletter envoyée à 3 abonné(s), 117 non joint(s).');
  });
});
