/* Ce que le relais raconte après coup, et ce qu'on en fait.

   Une adresse morte était silencieuse : le message partait, Brevo l'acceptait,
   EmailLog notait SENT, et le rejet qui suivait deux secondes plus tard
   n'atteignait personne. Ces tests éprouvent le chemin de retour — le webhook,
   la trace qui apprend le sort du message, et la liste des adresses auxquelles
   on cesse d'écrire. */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import {
  boiteDEnvoi,
  viderBoite,
  registreEmails,
  viderRegistre,
  registreSuppressions,
  viderSuppressions,
  ecarterAdresse,
  registreComptes,
  viderComptes,
  inscrireCompte,
  retablirSmtp,
  simulerPanneDeBase,
} from '../helpers/boiteDEnvoi.js';
import { appeler } from '../helpers/expressFactice.js';
import { adherente } from '../fixtures/destinataires.js';

vi.mock('nodemailer', async () => (await import('../helpers/boiteDEnvoi.js')).fauxNodemailer);
vi.mock('../../src/config/database.js', async () => (await import('../helpers/boiteDEnvoi.js')).fausseBase);

const emails = (await import('../../src/services/email.service.js')).default;
const { receiveBrevoEvent } = await import('../../src/controllers/emails.controller.js');

const SECRET = process.env.BREVO_WEBHOOK_SECRET;

// Un événement Brevo tel qu'il arrive : l'adresse, le sort, le message-id.
const evenement = (event, options = {}) => ({
  event,
  email: options.email ?? adherente.email,
  'message-id': options.messageId ?? '<message-de-test>',
  ts_event: options.ts ?? 1_755_000_000,
  reason: options.reason,
});

/* Les quatre formes que la console Brevo sait produire. Le webhook doit les
   accepter toutes : l'option offerte varie d'un écran à l'autre, et une seule
   forme supportée transformerait ce choix en impasse. */
const PORTEURS = {
  entete:  (secret) => ({ headers: { 'x-webhook-secret': secret }, query: {} }),
  url:     (secret) => ({ headers: {}, query: { s: secret } }),
  bearer:  (secret) => ({ headers: { authorization: `Bearer ${secret}` }, query: {} }),
  nu:      (secret) => ({ headers: { authorization: secret }, query: {} }),
  basique: (secret) => ({ headers: { authorization: `Basic ${Buffer.from(`brevo:${secret}`).toString('base64')}` }, query: {} }),
};

const poster = (corps, { secret = SECRET, porteur = 'entete' } = {}) => appeler(receiveBrevoEvent, {
  body: corps,
  ...PORTEURS[porteur](secret),
});

let erreursConsole;

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

beforeEach(() => {
  viderBoite();
  viderRegistre();
  viderSuppressions();
  viderComptes();
  retablirSmtp();
  simulerPanneDeBase(false);
  erreursConsole = [];
  vi.spyOn(console, 'warn').mockImplementation((...args) => { erreursConsole.push(args.join(' ')); });
  vi.spyOn(console, 'error').mockImplementation((...args) => { erreursConsole.push(args.join(' ')); });
});

afterEach(() => {
  vi.mocked(console.warn).mockRestore();
  vi.mocked(console.error).mockRestore();
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('La porte du webhook', () => {
  it('refuse un appel sans secret', async () => {
    const reponse = await poster(evenement('hard_bounce'), { secret: '' });

    expect(reponse.statut).toBe(401);
    expect(registreSuppressions).toHaveLength(0);
  });

  it('refuse un secret qui ressemble au bon', async () => {
    const reponse = await poster(evenement('hard_bounce'), { secret: `${SECRET}x` });

    expect(reponse.statut).toBe(401);
    expect(registreSuppressions).toHaveLength(0);
  });

  it.each([
    ['un en-tête libre',            'entete'],
    ['un paramètre d\'URL',         'url'],
    ['un token',                    'bearer'],
    ['un token sans son préfixe',   'nu'],
    ['une authentification basique', 'basique'],
  ])('accepte le secret porté par %s', async (_forme, porteur) => {
    const reponse = await poster(evenement('hard_bounce'), { porteur });

    expect(reponse.statut).toBe(200);
    expect(registreSuppressions).toHaveLength(1);
  });

  it('refuse un mot de passe basique qui n\'est pas le secret', async () => {
    const reponse = await poster(evenement('hard_bounce'), { secret: 'pas-le-bon', porteur: 'basique' });

    expect(reponse.statut).toBe(401);
    expect(registreSuppressions).toHaveLength(0);
  });
});

describe('Ce que chaque événement change', () => {
  beforeEach(async () => {
    await emails.sendWelcomeEmail(adherente);
  });

  it('un rejet définitif écarte l\'adresse et marque la trace', async () => {
    await poster(evenement('hard_bounce', { reason: 'unknown recipient' }));

    expect(registreEmails[0].delivery).toBe('HARD_BOUNCE');
    expect(registreSuppressions).toHaveLength(1);
    expect(registreSuppressions[0].email).toBe(adherente.email.toLowerCase());
    expect(registreSuppressions[0].detail).toBe('unknown recipient');
  });

  it('une adresse invalide vaut un rejet définitif', async () => {
    await poster(evenement('invalid_email'));

    expect(registreEmails[0].delivery).toBe('HARD_BOUNCE');
    expect(registreSuppressions).toHaveLength(1);
  });

  /* Brevo nomme ses événements `hard_bounce` dans la charge postée et
     `hardBounce` dans la liste d'abonnement de son API. Parier sur une seule
     graphie, c'est risquer de laisser passer un rejet sans le voir. */
  it.each([
    ['hardBounce',   'HARD_BOUNCE'],
    ['softBounce',   'SOFT_BOUNCE'],
    ['invalid',      'HARD_BOUNCE'],
    ['hard-bounce',  'HARD_BOUNCE'],
  ])('reconnaît « %s » comme les autres graphies', async (nom, attendu) => {
    await poster(evenement(nom));

    expect(registreEmails[0].delivery).toBe(attendu);
  });

  it('une boîte pleine ne fait que marquer la trace', async () => {
    await poster(evenement('soft_bounce', { reason: 'mailbox full' }));

    expect(registreEmails[0].delivery).toBe('SOFT_BOUNCE');
    /* Le rejet est passager : écarter l'adresse priverait de panier quelqu'un
       qui n'a rien demandé, le temps qu'il fasse le ménage dans sa boîte. */
    expect(registreSuppressions).toHaveLength(0);
  });

  it('une remise réussie note la trace sans rien couper', async () => {
    await poster(evenement('delivered'));

    expect(registreEmails[0].delivery).toBe('DELIVERED');
    expect(registreSuppressions).toHaveLength(0);
  });

  it('une ouverture ne change rien : elle ne dit rien qu\'on ait besoin de garder', async () => {
    await poster(evenement('opened'));

    expect(registreEmails[0].delivery).toBeUndefined();
    expect(registreSuppressions).toHaveLength(0);
  });

  it('date la trace à l\'heure de l\'événement, pas à celle de sa réception', async () => {
    await poster(evenement('delivered', { ts: 1_700_000_000 }));

    expect(registreEmails[0].deliveredAt).toEqual(new Date(1_700_000_000 * 1000));
  });
});

describe('La plainte pour spam coupe la lettre, pas le contrat', () => {
  beforeEach(async () => {
    inscrireCompte(adherente.email);
    await emails.sendWelcomeEmail(adherente);
  });

  it('retire l\'adhérent de la lettre d\'information', async () => {
    await poster(evenement('spam'));

    expect(registreComptes[0].newsletterOptIn).toBe(false);
    expect(registreComptes[0].newsletterOptOutAt).toBeInstanceOf(Date);
  });

  it('n\'écarte pas l\'adresse : l\'avis de dépôt de chèque doit continuer d\'arriver', async () => {
    await poster(evenement('spam'));

    expect(registreSuppressions).toHaveLength(0);
    expect(registreEmails[0].delivery).toBe('SPAM_COMPLAINT');
  });

  it('reconnaît le compte quelle que soit la casse de l\'adresse', async () => {
    await poster(evenement('spam', { email: adherente.email.toUpperCase() }));

    expect(registreComptes[0].newsletterOptIn).toBe(false);
  });
});

describe('La jointure avec la trace d\'envoi', () => {
  beforeEach(async () => {
    await emails.sendWelcomeEmail(adherente);
  });

  /* nodemailer pose le Message-ID entre chevrons, Brevo le renvoie tantôt nu,
     tantôt entouré. Sans les deux formes, la jointure rate une fois sur deux
     selon l'humeur du relais. */
  it('retrouve la trace, le message-id fût-il nu', async () => {
    await poster(evenement('hard_bounce', { messageId: 'message-de-test' }));

    expect(registreEmails[0].delivery).toBe('HARD_BOUNCE');
  });

  it('écarte quand même l\'adresse si aucune trace ne correspond', async () => {
    await poster(evenement('hard_bounce', { messageId: '<message-inconnu>' }));

    /* Le relais a pu réécrire le Message-ID, ou la trace avoir été purgée.
       L'adresse, elle, reste exploitable : c'est elle qui compte. */
    expect(registreEmails[0].delivery).toBeUndefined();
    expect(registreSuppressions).toHaveLength(1);
  });
});

describe('Un événement rejoué ne change rien de plus', () => {
  it('ne crée pas de doublon dans la liste des adresses écartées', async () => {
    await emails.sendWelcomeEmail(adherente);

    await poster(evenement('hard_bounce'));
    await poster(evenement('hard_bounce'));

    expect(registreSuppressions).toHaveLength(1);
  });
});

describe('Le webhook répond 200 à ce qu\'il ne comprend pas', () => {
  /* Un 500 fait réessayer Brevo, et une série d'échecs lui fait couper
     l'abonnement : on perdrait le signal au moment où il devient intéressant. */
  it.each([
    ['une charge vide', {}],
    ['un événement inconnu', { event: 'chose_inattendue', email: adherente.email }],
    ['un événement sans adresse', { event: 'hard_bounce' }],
  ])('%s', async (_nom, charge) => {
    const reponse = await poster(charge);

    expect(reponse.statut).toBe(200);
    expect(reponse.corps.success).toBe(true);
  });
});

describe('On cesse d\'écrire aux adresses mortes', () => {
  it('n\'envoie rien, et le dit', async () => {
    ecarterAdresse(adherente.email);

    const resultat = await emails.sendWelcomeEmail(adherente);

    expect(resultat.success).toBe(false);
    expect(boiteDEnvoi).toHaveLength(0);
    expect(erreursConsole.join('\n')).toContain('adresse écartée');
  });

  it('laisse malgré tout une trace, pour que le refus soit relisible', async () => {
    ecarterAdresse(adherente.email);

    await emails.sendWelcomeEmail(adherente);

    expect(registreEmails).toHaveLength(1);
    expect(registreEmails[0].status).toBe('FAILED');
    expect(registreEmails[0].error).toContain('HARD_BOUNCE');
  });

  it('reconnaît l\'adresse quelle que soit la casse', async () => {
    ecarterAdresse(adherente.email.toUpperCase());

    const resultat = await emails.sendWelcomeEmail(adherente);

    expect(resultat.success).toBe(false);
  });

  /* Le filet ne doit jamais devenir un bâillon : une base indisponible rendrait
     muette une application par ailleurs saine, y compris pour la
     réinitialisation d'un mot de passe. */
  it('laisse passer le message si la liste est illisible', async () => {
    simulerPanneDeBase();

    const resultat = await emails.sendWelcomeEmail(adherente);

    expect(resultat.success).toBe(true);
    expect(boiteDEnvoi).toHaveLength(1);
  });
});
