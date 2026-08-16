/* Poids du message et version texte — défauts M1 et M7.

   Le logo encodé pesait 166 ko et faisait tronquer le message chez Gmail, qui
   ne rend pas les data: URI. La version texte est désormais dérivée du HTML.

   Ces tests gardent surtout le poids, qui ne se voit pas, et la présence des
   liens en texte brut — un désabonnement promis doit exister là aussi. */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { boiteDEnvoi, viderBoite, viderRegistre, dernierMessage } from '../helpers/boiteDEnvoi.js';
import { messagesSortants } from '../fixtures/messagesSortants.js';
import {
  lettreDInformation,
  annonceDeService,
  adherente,
  panierHebdomadaire,
  ligneDeRemise,
} from '../fixtures/destinataires.js';

vi.mock('nodemailer', async () => (await import('../helpers/boiteDEnvoi.js')).fauxNodemailer);
vi.mock('../../src/config/database.js', async () => (await import('../helpers/boiteDEnvoi.js')).fausseBase);

const emails = (await import('../../src/services/email.service.js')).default;
const { emailToText } = await import('../../src/services/emailTheme.js');
const MESSAGES = messagesSortants(emails);

/* Le seuil au-delà duquel Gmail replie le message. On se donne une marge
   confortable : le but n'est pas de frôler la limite, c'est de ne plus jamais
   s'en approcher. */
const SEUIL_TRONCATURE_KO = 102;
const MARGE_RAISONNABLE_KO = 40;

const poids = (chaine) => Buffer.byteLength(String(chaine ?? ''), 'utf8') / 1024;

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  viderBoite();
  viderRegistre();
});

describe('Le logo ne voyage plus dans le message', () => {
  it.each(MESSAGES)('$nom ne transporte aucune image encodée', async ({ envoyer }) => {
    await envoyer();

    expect(dernierMessage().html).not.toContain('data:image');
  });

  it('pointe vers le fichier servi par le site', async () => {
    await emails.sendWelcomeEmail(adherente);

    expect(dernierMessage().html).toContain('src="https://auxptitspois.test/logo-email.png"');
  });

  it('et ce fichier existe vraiment, à une taille raisonnable', () => {
    /* Un lien vers une image absente donnerait un carré cassé dans toutes les
       boîtes. Le test traverse la frontière du monorepo à dessein : c'est le
       front qui sert le fichier que le back désigne. */
    const ici = path.dirname(fileURLToPath(import.meta.url));
    const logo = path.join(ici, '../../../frontend/public/logo-email.png');

    expect(fs.existsSync(logo)).toBe(true);
    expect(fs.statSync(logo).size / 1024).toBeLessThan(30);
  });
});

describe('Aucun message n\'approche du seuil de troncature de Gmail', () => {
  it.each(MESSAGES)('$nom', async ({ envoyer }) => {
    await envoyer();

    expect(poids(dernierMessage().html)).toBeLessThan(MARGE_RAISONNABLE_KO);
    expect(poids(dernierMessage().html)).toBeLessThan(SEUIL_TRONCATURE_KO);
  });

  it('même une newsletter au corps copieux', async () => {
    const corps = '<p>Des nouvelles du potager, et il y en a.</p>'.repeat(200);

    await emails.sendNewsletter({ ...lettreDInformation, content: corps }, [{ ...adherente }]);

    /* Le gabarit lui-même ne doit rien coûter : ce qui pèse, c'est le texte
       écrit par l'association, et c'est normal. */
    expect(poids(dernierMessage().html)).toBeLessThan(SEUIL_TRONCATURE_KO);
  });
});

describe('Chaque message part avec une version texte', () => {
  it.each(MESSAGES)('$nom', async ({ envoyer }) => {
    await envoyer();

    const { text } = dernierMessage();

    expect(text).toBeTruthy();
    expect(text).not.toMatch(/<[a-z][^>]*>/i);
    expect(text).not.toContain('&nbsp;');
  });

  it('garde les adresses des liens, sans quoi ils seraient du texte mort', async () => {
    await emails.sendWelcomeEmail(adherente);

    const { text } = dernierMessage();

    /* Le pied de page RGPD promet un accès à ses données : la promesse doit
       tenir aussi pour qui lit en texte brut. */
    expect(text).toContain('https://auxptitspois.test/compte');
    expect(text).toContain('Bonjour Camille');
  });

  it('porte le lien de désabonnement scellé dans la version texte d\'une newsletter', async () => {
    await emails.sendNewsletter(lettreDInformation, [{ ...adherente }]);

    expect(dernierMessage().text).toMatch(/desabonnement\?u=.+&t=[a-f0-9]{64}/);
  });

  it('laisse la main à un appelant qui fournirait la sienne', () => {
    /* Le dérivé n'est appliqué qu'à défaut : rien n'écrase une version texte
       explicite. */
    expect(emailToText('<p>Bonjour</p>')).toBe('Bonjour');
  });
});

describe('L\'en-tête de désabonnement natif de Gmail', () => {
  it('accompagne la lettre d\'information, en un clic', async () => {
    await emails.sendNewsletter(lettreDInformation, [{ ...adherente }]);

    const { headers } = dernierMessage();

    expect(headers['List-Unsubscribe']).toMatch(/^<https:\/\/api\.auxptitspois\.test\/api\/newsletters\/unsubscribe\?/);
    /* C'est cette seconde ligne que réclament les règles d'expéditeur de Gmail
       et Yahoo : sans elle, le bouton natif ne fait pas de POST. */
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('se replie sur la page de désabonnement sans PUBLIC_API_URL', async () => {
    const memoire = process.env.PUBLIC_API_URL;
    delete process.env.PUBLIC_API_URL;

    try {
      await emails.sendNewsletter(lettreDInformation, [{ ...adherente }]);
      const { headers } = dernierMessage();

      expect(headers['List-Unsubscribe']).toContain('/desabonnement?');
      /* Le repli n'annonce pas le clic unique, faute de route qui sache
         l'honorer : mieux vaut ne rien promettre. */
      expect(headers['List-Unsubscribe-Post']).toBeUndefined();
    } finally {
      process.env.PUBLIC_API_URL = memoire;
    }
  });

  it('n\'accompagne pas une annonce de service, qui ne se coupe pas', async () => {
    await emails.sendNewsletter(annonceDeService, [{ ...adherente }]);

    /* Une alerte continue d'arriver tant que le contrat court. Poser l'en-tête
       ferait promettre au bouton de Gmail un silence que l'application ne
       tiendra pas. */
    expect(dernierMessage().headers).toBeUndefined();
  });

  it('n\'accompagne pas le panier de la semaine, et c\'est un choix', async () => {
    await emails.sendWeeklyBasketNotification({ id: 'p1', distributionDate: '2026-09-02T16:00:00.000Z', items: [] }, [{ ...adherente }]);

    /* Même raison : aucune préférence de l'espace adhérent n'arrête ces
       messages tant que l'abonnement court. Un bouton « se désabonner » qui ne
       désabonne de rien vaut moins que pas de bouton du tout. */
    expect(dernierMessage().headers).toBeUndefined();
  });
});

describe('La ligne de prévisualisation de la boîte de réception', () => {
  /* Sous le sujet, le client mail affiche le début du corps. Sans texte prévu
     pour cet emplacement, il y met la salutation : « Bonjour Marie, Le panier
     de la semaine est prêt ! Voici ce que… ». Une ligne dépensée pour rien, à
     l'endroit précis où l'on décide d'ouvrir. */
  it('dit combien de produits attendent, plutôt que « Bonjour Marie »', async () => {
    await emails.sendWeeklyBasketNotification(panierHebdomadaire, [{ ...adherente }]);

    const { html } = dernierMessage();
    const avantLeCorps = html.split('<div class="wrapper">')[0];

    expect(avantLeCorps).toContain('2 produits de saison vous attendent');
    expect(avantLeCorps).toContain('pensez à vos sacs et cabas');
  });

  it('donne au trésorier le montant à déposer', async () => {
    await emails.sendTreasurerChequeDigest([ligneDeRemise]);

    expect(dernierMessage().html.split('<div class="wrapper">')[0]).toMatch(/365,00\s?€ à déposer/);
  });

  it('reste invisible à l\'ouverture du message', async () => {
    await emails.sendWeeklyBasketNotification(panierHebdomadaire, [{ ...adherente }]);

    const bloc = dernierMessage().html.match(/<div class="preheader"[^>]*>/)[0];

    /* Une seule déclaration ne suffit pas : display:none est ignoré par
       certains webmails, mso-hide ne parle qu'à Outlook. Les quatre ensemble
       couvrent le parc. */
    expect(bloc).toContain('display:none');
    expect(bloc).toContain('max-height:0');
    expect(bloc).toContain('opacity:0');
    expect(bloc).toContain('mso-hide:all');
  });

  it('ne laisse pas son rembourrage tomber dans la version texte', async () => {
    await emails.sendWeeklyBasketNotification(panierHebdomadaire, [{ ...adherente }]);

    const { text } = dernierMessage();

    /* Les entités invisibles qui empêchent Gmail de compléter la ligne ne sont
       pas décodées par le convertisseur : laissées passer, elles ouvriraient la
       version texte sur soixante « &#847; ». */
    expect(text).not.toContain('&#847;');
    expect(text).not.toContain('&zwnj;');
    expect(text).not.toContain('produits de saison vous attendent');
    // Le lecteur en texte brut retrouve le message tel qu'il s'ouvre à l'écran.
    expect(text.startsWith('Panier de la semaine')).toBe(true);
  });

  it('n\'écrit aucun bloc quand le message n\'en pose pas', async () => {
    /* La majorité des messages ouvrent sur un premier paragraphe déjà
       informatif. Le paramètre est facultatif, et son absence ne doit pas
       laisser une balise vide en tête de chaque email. */
    await emails.sendWelcomeEmail(adherente);

    expect(dernierMessage().html).not.toContain('class="preheader"');
  });
});

describe('Outlook sur Windows, dont le moteur de rendu est celui de Word', () => {
  it('reçoit une largeur en attribut, seule forme qu\'il respecte', async () => {
    await emails.sendWelcomeEmail(adherente);

    const { html } = dernierMessage();

    /* Word ignore max-width : sans cette table, le message s'étale sur toute la
       largeur de l'écran. Elle vit dans un commentaire conditionnel, donc
       n'existe que pour Outlook. */
    expect(html).toContain('<!--[if mso]><table role="presentation" width="600"');
    expect(html).toContain('<!--[if mso]></td></tr></table><![endif]-->');
  });

  it('et cette table ne se voit ni ailleurs, ni en texte brut', async () => {
    await emails.sendWelcomeEmail(adherente);

    const { html, text } = dernierMessage();

    // Ouvertures et fermetures appariées : un commentaire mal fermé afficherait son contenu partout.
    expect(html.match(/<!--\[if mso\]>/g)).toHaveLength(2);
    expect(html.match(/<!\[endif\]-->/g)).toHaveLength(2);
    expect(text).not.toMatch(/endif|role="presentation"/);
  });
});

describe('Les sujets ne redisent pas le nom de l\'expéditeur', () => {
  /* « Aux P'tits Pois » s'affiche déjà comme nom d'expéditeur, juste à gauche
     du sujet. Répété en suffixe, il consommait dix-huit caractères de l'espace
     visible sur mobile pour ne rien apprendre à personne.

     Ce qui est proscrit, c'est le suffixe mécanique, pas le nom lui-même : « Bienvenue
     chez Aux P'tits Pois » le porte à l'intérieur d'une phrase, où il désigne
     le lieu dans lequel on accueille quelqu'un. */
  it.each(MESSAGES)('$nom', async ({ envoyer }) => {
    await envoyer();

    expect(dernierMessage().subject).not.toMatch(/ - Aux P'tits Pois$/);
  });

  it('et tiennent dans ce qu\'un mobile affiche', async () => {
    for (const { envoyer } of MESSAGES) {
      await envoyer();

      expect(dernierMessage().subject.length).toBeLessThanOrEqual(62);
    }
  });
});

describe('La conversion en texte, dans le détail', () => {
  it('retire le contenu des blocs de style au lieu de le recopier', () => {
    expect(emailToText('<style>.a{color:red}</style><p>Bonjour</p>')).toBe('Bonjour');
  });

  it('transforme une liste en tirets', () => {
    expect(emailToText('<ul><li>Courgettes</li><li>Tomates</li></ul>')).toContain('- Courgettes');
  });

  it('décode les entités', () => {
    expect(emailToText('<p>Pommes &amp; poires</p>')).toBe('Pommes & poires');
  });

  it('n\'écrit pas deux fois une adresse qui est son propre libellé', () => {
    expect(emailToText('<a href="https://exemple.fr">https://exemple.fr</a>')).toBe('https://exemple.fr');
  });
});
