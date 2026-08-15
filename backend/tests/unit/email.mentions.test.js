/* Les mentions obligatoires du pied de page des emails — défaut m7.

   Ce que ce fichier verrouille. Tout message qui part du site porte, au bas de
   sa page, trois choses : l'adresse postale de l'association, la raison pour
   laquelle il arrive dans cette boîte-là, et le moyen d'exercer ses droits sur
   ses données. Les mentions avaient été ajoutées au fil de l'eau, chaque
   gabarit à sa façon ; certaines étaient complètes, d'autres à moitié, trois
   messages n'en portaient aucune — et c'étaient précisément ceux adressés à des
   gens qui ne sont pas adhérents.

   Le point de vigilance qui a motivé la moitié de ces tests : une mention de
   droits n'a de valeur que si elle mène à une porte ouverte. Écrire « ouvrez
   votre espace adhérent » à une candidate productrice qui n'a pas de compte ne
   vaut pas mieux que se taire. Les tests vérifient donc les deux : que la
   mention est là, et qu'elle mène quelque part.

   Comment on teste sans envoyer un seul email : nodemailer est remplacé par une
   fausse fabrique de transporteur (voir tests/helpers/boiteDEnvoi.js). Le
   service compose son HTML comme en production, et c'est ce HTML que les
   assertions lisent. */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import {
  boiteDEnvoi,
  viderBoite,
  dernierMessage,
  piedDePage,
} from '../helpers/boiteDEnvoi.js';
import {
  adherente,
  candidateProductrice,
  contrat,
  demandeAbonnement,
  permanence,
  cheque,
  ligneDeRemise,
  panierHebdomadaire,
  lettreDInformation,
  annonceDeService,
} from '../fixtures/destinataires.js';

/* Les deux remplacements doivent être en place avant que le service ne soit
   chargé : il fabrique son transporteur, et entraîne Prisma dans son sillage,
   dès la première ligne de son module. vi.mock est hissé en tête de fichier par
   Vitest, ce qui garantit cet ordre quelle que soit la position de ces lignes. */
vi.mock('nodemailer', async () => (await import('../helpers/boiteDEnvoi.js')).fauxNodemailer);
vi.mock('../../src/config/database.js', async () => (await import('../helpers/boiteDEnvoi.js')).fausseBase);

const ADRESSE_POSTALE = '14, rue du Château, 45300 Yèvre-la-Ville';
const PHRASE_DES_DROITS = 'consulter, modifier ou supprimer vos données';
const ESPACE_ADHERENT = 'https://auxptitspois.test/compte';
const ADRESSE_AMAP = 'auxptitspois@gmail.com';

let emails;

beforeAll(async () => {
  emails = (await import('../../src/services/email.service.js')).default;
  /* Le service annonce chaque envoi sur la console hors production ; la suite
     n'a pas à en hériter. */
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  viderBoite();
});

/* Le catalogue des messages sortants.

   `public` dit à quelle porte la mention des droits doit conduire :
     · adherent — l'espace adhérent, où l'export et la suppression sont en libre
       service ;
     · candidat — l'adresse de l'association, seule voie pour qui n'a pas de
       compte ;
     · interne — aucune, le destinataire étant l'association elle-même. */
const MESSAGES = [
  { nom: 'bienvenue', public: 'adherent', envoyer: () => emails.sendWelcomeEmail(adherente) },
  { nom: 'vérification d\'adresse', public: 'adherent', envoyer: () => emails.sendEmailVerification(adherente, 'jeton-de-test') },
  { nom: 'compte déjà existant', public: 'adherent', envoyer: () => emails.sendAccountAlreadyExists(adherente) },
  { nom: 'mot de passe oublié', public: 'adherent', envoyer: () => emails.sendPasswordResetEmail(adherente, 'jeton-de-test') },
  { nom: 'demande d\'abonnement reçue', public: 'adherent', envoyer: () => emails.sendSubscriptionRequestConfirmation(demandeAbonnement) },
  { nom: 'contrat activé', public: 'adherent', envoyer: () => emails.sendSubscriptionConfirmation(contrat, adherente) },
  { nom: 'contrat bientôt échu', public: 'adherent', envoyer: () => emails.sendRenewalReminderEmail(contrat, adherente) },
  { nom: 'contrat annulé', public: 'adherent', envoyer: () => emails.sendSubscriptionCancellation(contrat, adherente) },
  { nom: 'chèque bientôt déposé', public: 'adherent', envoyer: () => emails.sendChequeDepositNotice({ payment: cheque, subscription: contrat, user: adherente, rang: 3, total: 4 }) },
  { nom: 'permanence confirmée', public: 'adherent', envoyer: () => emails.sendShiftConfirmation(permanence, adherente) },
  { nom: 'permanence annulée', public: 'adherent', envoyer: () => emails.sendShiftCancellation(permanence, adherente) },
  { nom: 'désinscription d\'une permanence', public: 'adherent', envoyer: () => emails.sendShiftWithdrawal(permanence, adherente) },
  { nom: 'panier de la semaine', public: 'adherent', envoyer: () => emails.sendWeeklyBasketNotification(panierHebdomadaire, [{ ...adherente }]) },
  { nom: 'lettre d\'information', public: 'adherent', envoyer: () => emails.sendNewsletter(lettreDInformation, [{ ...adherente }]) },
  { nom: 'annonce de service', public: 'adherent', envoyer: () => emails.sendNewsletter(annonceDeService, [{ ...adherente }]) },
  { nom: 'candidature reçue', public: 'candidat', envoyer: () => emails.sendProducerInquiryConfirmation(candidateProductrice) },
  { nom: 'candidature acceptée', public: 'candidat', envoyer: () => emails.sendProducerInquiryAccepted(candidateProductrice) },
  { nom: 'candidature refusée', public: 'candidat', envoyer: () => emails.sendProducerInquiryRejected(candidateProductrice) },
  { nom: 'message de contact', public: 'interne', envoyer: () => emails.sendContactMessage({ name: 'Paul Girard', email: 'paul@example.org', subject: 'Une question', message: 'Bonjour' }) },
  { nom: 'remise de chèques', public: 'interne', envoyer: () => emails.sendTreasurerChequeDigest([ligneDeRemise]) },
];

describe('Le catalogue des messages est complet', () => {
  /* Sans ce test, ajouter un dix-neuvième email sans pied de page passerait
     inaperçu : la suite resterait verte en ne testant que les dix-huit
     précédents. Ici, tout `send…` du service doit figurer au catalogue. */
  it('couvre chaque expéditeur du service', async () => {
    const expediteurs = Object.getOwnPropertyNames(Object.getPrototypeOf(emails))
      .filter((nom) => nom.startsWith('send'))
      .sort();

    const couverts = new Set();
    for (const { envoyer } of MESSAGES) {
      couverts.add(envoyer.toString().match(/emails\.(send\w+)/)[1]);
    }

    expect([...couverts].sort()).toEqual(expediteurs);
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
    const pied = piedDePage(dernierMessage().html);

    expect(pied).toContain(ESPACE_ADHERENT);
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

describe('Aucun message n\'est parti pour de vrai', () => {
  it('capture les envois au lieu de les poster', async () => {
    await emails.sendWelcomeEmail(adherente);

    expect(boiteDEnvoi).toHaveLength(1);
    expect(dernierMessage().to).toBe(adherente.email);
  });
});
