/* Ce que l'adhérent voit vraiment d'une annonce de fermeture — défaut M5.

   Le contenu de cette annonce est écrit à un bout de l'application et mis en
   page à l'autre : le contrôleur des fermetures compose un morceau de HTML, le
   range en base sous forme de Newsletter, et le service d'emails l'insère au
   milieu de son propre gabarit. Trois fichiers, deux mécanismes de mise en
   forme, aucun endroit d'où l'on voit le résultat.

   D'où ce test, qui rejoue le trajet entier plutôt que ses morceaux : on crée
   une fermeture par le vrai contrôleur, on récupère la newsletter telle qu'elle
   est écrite en base, on la fait envoyer par le vrai service, et on lit le HTML
   remis au transporteur. C'est le seul point d'observation qui corresponde à ce
   qui arrive dans la boîte. */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';
import { EMAIL_PALETTE } from '../../src/services/emailTheme.js';

const { newslettersCreees } = vi.hoisted(() => ({ newslettersCreees: [] }));

vi.mock('nodemailer', async () => (await import('../helpers/boiteDEnvoi.js')).fauxNodemailer);

/* Le double de base fourni par boiteDEnvoi ne connaît que les tables du service
   d'emails ; le contrôleur des fermetures en touche trois autres. On les ajoute
   plutôt que de repartir de zéro, pour que la trace des envois reste celle que
   les autres tests observent. */
vi.mock('../../src/config/database.js', async () => {
  const { fausseBase } = await import('../helpers/boiteDEnvoi.js');

  return {
    ...fausseBase,
    prisma: {
      ...fausseBase.prisma,
      /* Terrain vide : ni fermeture existante, ni permanence programmée. Les
         gardes du contrôleur laissent passer, elles ne sont pas le sujet. */
      amapClosure: {
        create: async ({ data }) => ({ id: 'fermeture-0001', ...data }),
        findFirst: async () => null,
        findMany: async () => [],
      },
      shift: { findMany: async () => [] },
      newsletter: {
        create: async ({ data }) => {
          const ligne = { id: 'newsletter-annonce', status: 'DRAFT', sentAt: null, sentCount: 0, ...data };
          newslettersCreees.push(ligne);
          return ligne;
        },
      },
    },
  };
});

vi.mock('../../src/services/audit.service.js', () => ({ logAudit: async () => {} }));

vi.mock('../../src/services/newsletterAudience.service.js', () => ({
  resolveNewsletterRecipients: async () => [DESTINATAIRE],
  overridesOptOut: (type) => type === 'ALERT',
}));

/* La diffusion réelle part hors de la requête : la retenir ici rend le test
   déterministe, et c'est lui qui rejoue l'envoi juste après, avec le contenu
   exact que le contrôleur vient d'écrire. */
vi.mock('../../src/services/newsletterDispatch.service.js', () => ({
  reserverNewsletter: async () => true,
  lancerDiffusion: () => {},
}));

const DESTINATAIRE = { id: 'adherente-0001', email: 'colette@example.org', firstName: 'Colette' };

const { boiteDEnvoi, viderBoite, viderRegistre, dernierMessage } = await import('../helpers/boiteDEnvoi.js');
const emails = (await import('../../src/services/email.service.js')).default;
const { createClosure } = await import('../../src/controllers/closures.controller.js');

const requete = (body) => ({ body, user: { id: 'admin-0001', email: 'admin@example.org', firstName: 'Sofia' } });

/* La zone de contenu du gabarit, isolée du bandeau et du pied de page — même
   raison que piedDePage : sans ça, une assertion pourrait réussir grâce à un
   morceau de la coquille au lieu de l'annonce elle-même. */
function zoneDeContenu(html) {
  const bloc = String(html).split('<div class="content">')[1];
  if (!bloc) return '';

  return bloc.split('<div class="footer">')[0];
}

/* Crée une fermeture, puis envoie l'annonce que le contrôleur a écrite. Rend le
   message tel que le transporteur l'a reçu. */
async function annoncer({ startDate = '2026-08-12', endDate = '2026-08-26', reason = 'Congés d\'été' } = {}) {
  const { erreur, corps } = await appeler(createClosure, requete({ startDate, endDate, reason }));

  expect(erreur?.message ?? null).toBeNull();
  expect(corps?.success).toBe(true);
  expect(newslettersCreees).toHaveLength(1);

  await emails.sendNewsletter(newslettersCreees[0], [DESTINATAIRE]);

  return dernierMessage();
}

beforeAll(() => {
  // Le service annonce chaque envoi sur la console hors production.
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  newslettersCreees.length = 0;
  viderBoite();
  viderRegistre();
});

describe('L\'annonce de fermeture arrive mise en page', () => {
  it('n\'insère aucune ligne vide entre les paragraphes', async () => {
    const message = await annoncer();
    const contenu = zoneDeContenu(message.html);

    /* Le cœur du défaut : le contenu passait par une conversion des retours à
       la ligne en <br>, pensée pour du texte saisi au clavier. Appliquée à un
       gabarit indenté, elle ajoutait une ligne vide entre chaque balise. Le
       fragment n'ayant plus de retour à la ligne et la conversion ne visant
       plus le HTML, il ne doit rester que les <br> voulus — ici aucun. */
    expect(contenu.match(/<br\s*\/?>/gi) ?? []).toHaveLength(0);
  });

  it('conserve la mise en valeur de la période de fermeture', async () => {
    const message = await annoncer();
    const contenu = zoneDeContenu(message.html);

    /* Les styles sont en ligne parce qu'un bloc <style> ne survivrait ni au
       nettoyage en aval ni à la moitié des clients de messagerie. Encore
       faut-il qu'ils traversent le nettoyage : c'est ce qui se vérifie ici. */
    expect(contenu).toContain(`background:${EMAIL_PALETTE.sand}`);
    expect(contenu).toContain(`border-left:3px solid ${EMAIL_PALETTE.terracotta}`);
  });

  it('ne laisse aucune classe orpheline du gabarit englobant', async () => {
    const message = await annoncer();
    const contenu = zoneDeContenu(message.html);

    /* L'ancien document réutilisait wrapper, header, body et footer — les noms
       mêmes du gabarit qui l'accueille. L'adhérent recevait donc deux bandeaux
       et deux pieds de page. Aucune classe ne doit plus sortir du fragment. */
    expect(contenu).not.toMatch(/class="/);
  });

  it('ne glisse pas un second document dans le premier', async () => {
    const message = await annoncer();
    const contenu = zoneDeContenu(message.html);

    expect(contenu).not.toMatch(/<!DOCTYPE|<html|<head|<style|<body/i);
    // Un seul document, donc un seul DOCTYPE : celui du gabarit.
    expect(message.html.match(/<!DOCTYPE/gi)).toHaveLength(1);
  });

  it('dit les dates et le motif', async () => {
    const message = await annoncer();
    const contenu = zoneDeContenu(message.html);

    expect(contenu).toContain('fermée du 12 août 2026 au 26 août 2026');
    expect(contenu).toContain('Congés d\'été');
    expect(message.subject).toContain('Fermeture de l\'AMAP du 12 août 2026 au 26 août 2026');
  });

  it('neutralise un motif qui contiendrait du HTML', async () => {
    const message = await annoncer({ reason: '<img src=x onerror=alert(1)>Travaux' });
    const contenu = zoneDeContenu(message.html);

    /* Le motif est saisi par un administrateur, pas par un inconnu — mais il
       finit dans la boîte de quatre-vingts personnes. Échappé à la source, il
       doit se lire tel qu'il a été tapé, sans devenir une balise : c'est le
       texte « <img … > » qui s'affiche, et aucune image n'est chargée. */
    expect(contenu).not.toMatch(/<img/i);
    expect(contenu).toContain('&lt;img src=x onerror=alert(1)&gt;Travaux');
  });
});

describe('Le texte saisi à la main garde ses retours à la ligne', () => {
  /* Contre-épreuve indispensable : la conversion en <br> n'a pas été supprimée
     mais conditionnée. Si elle cessait de s'appliquer au texte brut, une lettre
     d'information rédigée dans l'écran de communication arriverait d'un seul
     bloc — le défaut inverse, tout aussi silencieux. */
  it('convertit les sauts de ligne d\'une lettre écrite au clavier', async () => {
    const lettre = {
      id: 'newsletter-0002',
      subject: 'La lettre de rentrée',
      type: 'NEWSLETTER',
      content: 'Bonjour,\n\nLa distribution de mercredi est décalée à jeudi.\n\nÀ bientôt.',
    };

    await emails.sendNewsletter(lettre, [DESTINATAIRE]);

    const contenu = zoneDeContenu(dernierMessage().html);

    expect(contenu.match(/<br\s*\/?>/gi) ?? []).toHaveLength(4);
    expect(contenu).toContain('La distribution de mercredi est décalée à jeudi.');
  });

  it('n\'envoie qu\'un message par destinataire', async () => {
    await annoncer();

    expect(boiteDEnvoi).toHaveLength(1);
  });
});
