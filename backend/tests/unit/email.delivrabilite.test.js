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
import { lettreDInformation, annonceDeService, adherente } from '../fixtures/destinataires.js';

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
