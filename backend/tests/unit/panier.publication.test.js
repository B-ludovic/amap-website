/* Publication du panier de la semaine — le verrou de M2, appliqué ici.

   Publier envoie à tous les abonnés actifs. Tant que le verrou vivait dans
   l'écran — le bouton disparaît une fois le panier publié — deux onglets
   ouverts, ou une liste pas rafraîchie, suffisaient à faire partir la
   notification deux fois. Le verrou se prend désormais en base, par la même
   écriture conditionnelle que la réservation d'une newsletter.

   L'envoi lui-même n'est pas attendu par le contrôleur : on vérifie ici qui
   déclenche la notification, pas ce qu'elle devient. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';

const { scenario, etat, notifications } = vi.hoisted(() => ({
  scenario: {},
  etat: { panier: null },
  notifications: [],
}));

/* La diffusion elle-même a son fichier (panier.notification.test.js). Ici on ne
   vérifie qu'une chose à son sujet : combien de fois elle est déclenchée. */
vi.mock('../../src/services/weeklyBasketDispatch.service.js', () => ({
  reserverNotification: async () => true,
  destinatairesRestants: async () => scenario.abonnes.map((a) => a.user),
  lancerNotification: ({ basket, recipients }) => {
    notifications.push({ basketId: basket.id, destinataires: recipients.length });
  },
}));

vi.mock('../../src/services/audit.service.js', () => ({ logAudit: async () => {} }));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    weeklyBasket: {
      findUnique: async ({ where }) => {
        /* La porte tient les deux requêtes ensemble au moment précis où elles
           lisent l'état : c'est la seule fenêtre où toutes deux peuvent voir le
           panier encore à publier, donc le seul endroit d'où éprouver le
           compare-and-set. */
        if (scenario.porte) await scenario.porte;

        /* Une copie, comme le ferait Prisma. Rendre la ligne vivante ferait
           voir à la seconde requête l'écriture de la première : elle se ferait
           recaler par le contrôle synchrone, et le verrou ne serait jamais
           éprouvé — le test passerait sans lui. */
        return where.id === etat.panier?.id ? { ...etat.panier } : null;
      },

      /* Ce que fait un UPDATE … WHERE "isPublished" = false : l'écriture n'est
         acceptée que si la condition tient encore au moment où elle s'exécute.
         La base arbitre, pas l'ordre d'arrivée des requêtes. */
      updateMany: async ({ where, data }) => {
        if (where.id !== etat.panier?.id) return { count: 0 };
        if (where.isPublished === false && etat.panier.isPublished) return { count: 0 };

        Object.assign(etat.panier, data);
        return { count: 1 };
      },
    },
  },
}));

const { publishWeeklyBasket } = await import('../../src/controllers/weekly-baskets.controller.js');

const requete = {
  params: { id: 'panier-0001' },
  user: { id: 'admin-0001', email: 'admin@example.org', firstName: 'Sofia' },
  ip: '203.0.113.7',
};

const abonnes = (nombre) => Array.from({ length: nombre }, (_, i) => ({
  user: { firstName: 'Adhérent', email: `adherent${i}@example.org` },
}));

function poserScenario({ isPublished = false, items = [{ id: 'item-1' }], nombreAbonnes = 180 } = {}) {
  scenario.porte = null;
  scenario.abonnes = abonnes(nombreAbonnes);

  etat.panier = {
    id: 'panier-0001',
    weekNumber: 36,
    year: 2026,
    isPublished,
    publishedAt: isPublished ? new Date('2026-09-02T06:00:00.000Z') : null,
    items,
  };
}

beforeEach(() => {
  notifications.length = 0;
  poserScenario();
});

describe('Publier un panier prévient les abonnés actifs', () => {
  it('répond, publie, et déclenche une notification', async () => {
    const { statut, message } = await appeler(publishWeeklyBasket, requete);

    expect(statut).toBe(200);
    expect(message).toBe('Panier hebdomadaire publié avec succès');
    expect(etat.panier.isPublished).toBe(true);
    expect(etat.panier.publishedAt).toBeInstanceOf(Date);
    expect(notifications).toEqual([{ basketId: 'panier-0001', destinataires: 180 }]);
  });
});

describe('Un panier déjà publié ne repart pas', () => {
  it('refuse et ne prévient personne une seconde fois', async () => {
    poserScenario({ isPublished: true });

    const { statut, message } = await appeler(publishWeeklyBasket, requete);

    expect(statut).toBe(409);
    expect(message).toBe('Ce panier a déjà été publié');
    expect(notifications).toHaveLength(0);
  });

  /* La date de publication est la seule trace de l'envoi initial : la réécrire
     ferait passer une republication refusée pour un envoi du jour. */
  it('laisse intacte la date de la publication d\'origine', async () => {
    poserScenario({ isPublished: true });
    const origine = etat.panier.publishedAt;

    await appeler(publishWeeklyBasket, requete);

    expect(etat.panier.publishedAt).toBe(origine);
  });
});

describe('Deux publications qui se croisent avant que l\'une ait écrit', () => {
  it('n\'en laisse passer qu\'une, et c\'est la base qui tranche', async () => {
    let ouvrir;
    scenario.porte = new Promise((resolve) => { ouvrir = resolve; });

    /* Les deux requêtes lisent le panier avant que l'une ait publié : le
       contrôle du dessus les laisse toutes deux passer, il ne reste que
       l'écriture conditionnelle pour les départager. */
    const course = Promise.all([
      appeler(publishWeeklyBasket, requete),
      appeler(publishWeeklyBasket, requete),
    ]);

    ouvrir();
    const resultats = await course;

    const statuts = resultats.map((r) => r.statut).sort();

    expect(statuts).toEqual([200, 409]);
    // Le vrai enjeu : cent quatre-vingts adhérents prévenus une fois, pas deux.
    expect(notifications).toHaveLength(1);
  });
});

describe('Les gardes qui précèdent le verrou restent distinctes', () => {
  it('refuse un panier introuvable', async () => {
    etat.panier = null;

    const { statut } = await appeler(publishWeeklyBasket, requete);

    expect(statut).toBe(404);
    expect(notifications).toHaveLength(0);
  });

  it('refuse un panier vide, sans le publier au passage', async () => {
    poserScenario({ items: [] });

    const { statut, message } = await appeler(publishWeeklyBasket, requete);

    expect(statut).toBe(400);
    expect(message).toBe('Le panier doit contenir au moins un produit');
    expect(etat.panier.isPublished).toBe(false);
    expect(notifications).toHaveLength(0);
  });
});
