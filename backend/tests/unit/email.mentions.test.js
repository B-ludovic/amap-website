/* Mentions obligatoires du pied de page — défaut m7.

   Trois mentions dans chaque message : adresse postale, motif de réception,
   moyen d'exercer ses droits. Les tests vérifient aussi que la mention mène à
   une porte ouverte — un candidat producteur n'a pas d'espace adhérent. */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import {
  boiteDEnvoi,
  viderBoite,
  viderRegistre,
  dernierMessage,
  piedDePage,
} from '../helpers/boiteDEnvoi.js';
import { messagesSortants } from '../fixtures/messagesSortants.js';
import { adherente, demandeAbonnement } from '../fixtures/destinataires.js';

/* Les deux remplacements doivent être en place avant que le service ne soit
   chargé : il fabrique son transporteur, et instancie Prisma dans son sillage,
   dès la première ligne de son module. vi.mock est hissé en tête de fichier par
   Vitest, donc au-dessus de l'import qui suit, quelle que soit sa position. */
vi.mock('nodemailer', async () => (await import('../helpers/boiteDEnvoi.js')).fauxNodemailer);
vi.mock('../../src/config/database.js', async () => (await import('../helpers/boiteDEnvoi.js')).fausseBase);

const emails = (await import('../../src/services/email.service.js')).default;
const MESSAGES = messagesSortants(emails);

const ADRESSE_POSTALE = '14, rue du Château, 45300 Yèvre-la-Ville';
const PHRASE_DES_DROITS = 'consulter, modifier ou supprimer vos données';
const ESPACE_ADHERENT = 'https://auxptitspois.test/compte';
/* Lue, et non recopiée : un test qui répéterait l'adresse en clair resterait
   vert le jour où le code cesserait de suivre la variable d'environnement. */
const { CONTACT_EMAIL: ADRESSE_AMAP } = await import('../../src/config/association.js');

beforeAll(() => {
  /* Le service annonce chaque envoi sur la console hors production ; la suite
     n'a pas à en hériter. */
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  viderBoite();
  viderRegistre();
});

describe('Le catalogue des messages est complet', () => {
  /* Sans ce test, ajouter un email sans pied de page passerait inaperçu : la
     suite resterait verte en ne testant que les précédents. Ici, tout `send…`
     du service doit figurer au catalogue. */
  it('couvre chaque expéditeur du service', () => {
    const expediteurs = Object.getOwnPropertyNames(Object.getPrototypeOf(emails))
      .filter((nom) => nom.startsWith('send'))
      .sort();

    const couverts = [...new Set(MESSAGES.map((m) => m.methode))].sort();

    expect(couverts).toEqual(expediteurs);
  });
});

describe('Tout message sortant porte les mentions obligatoires', () => {
  it.each(MESSAGES)('$nom', async ({ envoyer }) => {
    const resultat = await envoyer();
    expect(resultat.success).toBe(true);

    const pied = piedDePage(dernierMessage().html);

    expect(pied, 'adresse postale de l\'association').toContain(ADRESSE_POSTALE);
    expect(pied, 'motif de réception').toMatch(/Cet email a été envoyé à|Vous recevez cet email parce que|Ce message concerne votre contrat|Message automatique/);
  });
});

describe('La mention des droits mène à une porte ouverte', () => {
  const versLAdherent = MESSAGES.filter((m) => m.public === 'adherent');
  const versLeCandidat = MESSAGES.filter((m) => m.public === 'candidat');
  const versLInterne = MESSAGES.filter((m) => m.public === 'interne');

  it.each(versLAdherent)('$nom renvoie vers l\'espace adhérent', async ({ envoyer }) => {
    await envoyer();
    const pied = piedDePage(dernierMessage().html);

    expect(pied).toContain(PHRASE_DES_DROITS);
    expect(pied).toContain(ESPACE_ADHERENT);
  });

  it.each(versLeCandidat)('$nom renvoie vers l\'adresse de l\'association', async ({ envoyer }) => {
    await envoyer();
    const pied = piedDePage(dernierMessage().html);

    expect(pied).toContain(PHRASE_DES_DROITS);
    expect(pied).toContain(`mailto:${ADRESSE_AMAP}`);
    /* Le cœur du défaut : cette personne n'a pas de compte. Lui proposer un
       espace adhérent serait la renvoyer vers une porte fermée. */
    expect(pied).not.toContain('espace adhérent');
    expect(pied).not.toContain(ESPACE_ADHERENT);
  });

  it.each(versLInterne)('$nom ne mentionne aucun droit, et c\'est voulu', async ({ envoyer }) => {
    await envoyer();
    const pied = piedDePage(dernierMessage().html);

    /* Exception assumée : ces deux messages arrivent dans la boîte de
       l'association, pas dans celle de la personne dont ils parlent. Il n'y a
       personne à informer de ses propres droits. */
    expect(pied).not.toContain(PHRASE_DES_DROITS);
    expect(pied).toContain('Message automatique');
  });
});

describe('La demande d\'abonnement suit la donnée, pas une supposition', () => {
  it('renvoie vers l\'espace adhérent quand la demande porte un compte', async () => {
    await emails.sendSubscriptionRequestConfirmation(demandeAbonnement);

    expect(piedDePage(dernierMessage().html)).toContain(ESPACE_ADHERENT);
  });

  it('renvoie vers l\'adresse de l\'association quand la demande n\'a pas de compte', async () => {
    await emails.sendSubscriptionRequestConfirmation({ ...demandeAbonnement, userId: null });
    const pied = piedDePage(dernierMessage().html);

    expect(pied).toContain(`mailto:${ADRESSE_AMAP}`);
    expect(pied).not.toContain(ESPACE_ADHERENT);
  });
});

describe('Le pied de page de la newsletter', () => {
  /* La méthode est statique et se laisse appeler seule, sans passer par un
     envoi : les trois branches se lisent d'un coup. */
  const footer = (...args) => Object.getPrototypeOf(emails).constructor.newsletterFooter(...args);

  it('annonce le motif, les droits et le désabonnement, dans cet ordre', () => {
    const { html } = footer('destinataire-0001', true);

    expect(html.indexOf('Vous recevez cet email parce que'))
      .toBeLessThan(html.indexOf(PHRASE_DES_DROITS));
    expect(html.indexOf(PHRASE_DES_DROITS))
      .toBeLessThan(html.indexOf('Me désabonner'));
  });

  it('scelle le lien de désabonnement pour cette personne', () => {
    const { html, headers } = footer('destinataire-0001', true);

    expect(html).toMatch(/\/desabonnement\?u=destinataire-0001&amp;t=[a-f0-9]{64}/);
    expect(headers).toHaveProperty('List-Unsubscribe');
  });

  it('dit franchement qu\'une annonce de service ne se coupe pas', () => {
    const { html, headers } = footer('destinataire-0001', false);

    expect(html).toContain('il vous parvient même si vous avez quitté la lettre d\'information');
    expect(html).toContain(PHRASE_DES_DROITS);
    /* Aucun en-tête de désabonnement ici : le bouton de Gmail promettrait un
       silence que l'application ne tiendra pas. */
    expect(headers).toBeUndefined();
  });

  it('renvoie vers l\'espace adhérent faute d\'identifiant à sceller', () => {
    const { html, headers } = footer(null, true);

    expect(html).toContain(ESPACE_ADHERENT);
    expect(html).not.toContain('/desabonnement');
    expect(headers).toBeUndefined();
  });
});

describe('L\'adresse du destinataire est reprise telle quelle, jamais interprétée', () => {
  it('échappe une adresse qui contiendrait du HTML', async () => {
    await emails.sendWelcomeEmail({ ...adherente, email: 'a<script>alert(1)</script>@example.org' });
    const pied = piedDePage(dernierMessage().html);

    expect(pied).toContain('&lt;script&gt;');
    expect(pied).not.toContain('<script>');
  });
});

describe('L\'adresse de contact n\'a qu\'une source', () => {
  /* Elle était recopiée dans six gabarits et dans l'écran de désabonnement. Le
     jour d'un changement de boîte, chaque copie oubliée invite les adhérents à
     écrire dans le vide — et le formulaire de contact poste au même endroit.

     La suite tourne avec CONTACT_EMAIL réglée sur une adresse de test : toute
     recopie de l'ancienne adresse ressort donc au grand jour. */
  const ADRESSE_ABANDONNEE = 'auxptitspois@gmail.com';

  it.each(MESSAGES)('$nom ne recopie aucune adresse en dur', async ({ envoyer }) => {
    await envoyer();

    const { html, text, to } = dernierMessage();

    expect(html).not.toContain(ADRESSE_ABANDONNEE);
    expect(text).not.toContain(ADRESSE_ABANDONNEE);
    expect(to).not.toBe(ADRESSE_ABANDONNEE);
  });

  it('achemine le formulaire de contact vers la boîte configurée', async () => {
    await emails.sendContactMessage({
      name: 'Paul Girard',
      email: 'paul@example.org',
      subject: 'Une question',
      message: 'Bonjour',
    });

    expect(dernierMessage().to).toBe(ADRESSE_AMAP);
    // Répondre au message doit écrire à son auteur, pas à l'association.
    expect(dernierMessage().replyTo).toBe('paul@example.org');
  });
});

describe('Aucun message n\'est parti pour de vrai', () => {
  it('capture les envois au lieu de les poster', async () => {
    await emails.sendWelcomeEmail(adherente);

    expect(boiteDEnvoi).toHaveLength(1);
    expect(dernierMessage().to).toBe(adherente.email);
  });
});
