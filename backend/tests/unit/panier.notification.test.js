/* La notification du panier hebdomadaire et sa reprise — défaut M3.

   Publier prévient tous les abonnés actifs. La boucle quitte la requête, donc
   elle peut mourir en chemin : un redéploiement, une instance qui s'endort. Ce
   qui se vérifie ici, c'est qu'elle reprenne là où elle s'est arrêtée, sans
   réécrire à ceux qui ont déjà reçu.

   EmailLog est l'arbitre. Ces tests s'écrivent donc en posant des lignes de
   trace, comme le ferait un envoi réel, et en regardant qui reçoit ensuite. */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { base, envois } = vi.hoisted(() => ({
  base: { paniers: [], abonnements: [], traces: [] },
  envois: [],
}));

vi.mock('../../src/services/email.service.js', () => ({
  default: {
    sendWeeklyBasketNotification: async (basket, recipients) => {
      envois.push({ basketId: basket.id, adresses: recipients.map((r) => r.email) });

      // Un envoi réussi laisse sa trace, comme le fait #send en vrai.
      for (const destinataire of recipients) {
        base.traces.push({ kind: 'WEEKLY_BASKET', status: 'SENT', ref: basket.id, to: destinataire.email });
      }

      return { success: true, results: { sent: recipients.length, failed: 0, errors: [] } };
    },
  },
}));

const correspond = (ligne, where) =>
  (!where.kind || ligne.kind === where.kind)
  && (!where.status || ligne.status === where.status)
  && (!where.ref || ligne.ref === where.ref);

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    weeklyBasket: {
      findMany: async ({ where }) => base.paniers.filter((p) =>
        (where.isPublished === undefined || p.isPublished === where.isPublished)
        && (!where.distributionDate?.gte || p.distributionDate >= where.distributionDate.gte)
      ),

      update: async ({ where, data }) => {
        const cible = base.paniers.find((p) => p.id === where.id);
        Object.assign(cible, data);
        return cible;
      },

      /* Le drapeau : libre s'il est nul, ou s'il est plus vieux que le sursis.
         C'est ce que fait un UPDATE … WHERE notifyingSince IS NULL OR
         notifyingSince <= …, et c'est ce qui permet de reprendre après une
         panne sans doubler une boucle vivante. */
      updateMany: async ({ where, data }) => {
        const cible = base.paniers.find((p) => p.id === where.id);
        if (!cible) return { count: 0 };

        const seuil = where.OR?.[1]?.notifyingSince?.lte;
        const libre = cible.notifyingSince === null || (seuil && cible.notifyingSince <= seuil);

        if (!libre) return { count: 0 };

        Object.assign(cible, data);
        return { count: 1 };
      },
    },

    subscription: {
      findMany: async () => base.abonnements,
    },

    emailLog: {
      findMany: async ({ where }) => {
        const lignes = base.traces.filter((l) => correspond(l, where));
        return [...new Map(lignes.map((l) => [l.to, { to: l.to }])).values()];
      },
      count: async ({ where }) => base.traces.filter((l) => correspond(l, where)).length,
    },
  },
}));

const { destinatairesRestants, diffuserPanier, reserverNotification } =
  await import('../../src/services/weeklyBasketDispatch.service.js');
const { reprendreNotificationsPaniers } = await import('../../src/jobs/weeklyBasketNotify.job.js');

const HEURES = 60 * 60 * 1000;
const ilYA = (ms) => new Date(Date.now() - ms);
const dans = (ms) => new Date(Date.now() + ms);

const abonnes = (nombre) => Array.from({ length: nombre }, (_, i) => ({
  status: 'ACTIVE',
  user: { firstName: 'Adhérent', email: `adherent${i}@example.org` },
}));

function poserBase({
  distributionDate = dans(6 * HEURES),
  isPublished = true,
  notifyingSince = null,
  nombreAbonnes = 5,
  traces = [],
} = {}) {
  base.paniers = [{
    id: 'panier-0001',
    weekNumber: 36,
    year: 2026,
    distributionDate,
    isPublished,
    notifiedCount: 0,
    notifyFailedCount: 0,
    notifyingSince,
    items: [{ id: 'item-1' }],
  }];
  base.abonnements = abonnes(nombreAbonnes);
  base.traces = traces;
}

const traceSent = (i) => ({ kind: 'WEEKLY_BASKET', status: 'SENT', ref: 'panier-0001', to: `adherent${i}@example.org` });
const traceFailed = (i) => ({ kind: 'WEEKLY_BASKET', status: 'FAILED', ref: 'panier-0001', to: `adherent${i}@example.org` });

let journal;

beforeEach(() => {
  envois.length = 0;
  journal = [];
  vi.spyOn(console, 'warn').mockImplementation((...a) => journal.push(a.join(' ')));
  vi.spyOn(console, 'error').mockImplementation((...a) => journal.push(a.join(' ')));
  poserBase();
});

describe('Qui reste à prévenir', () => {
  it('tout le monde quand rien n\'est parti', async () => {
    expect(await destinatairesRestants('panier-0001')).toHaveLength(5);
  });

  it('personne de ceux qui ont déjà leur trace', async () => {
    poserBase({ traces: [traceSent(0), traceSent(1)] });

    const restants = await destinatairesRestants('panier-0001');

    expect(restants.map((r) => r.email)).toEqual([
      'adherent2@example.org', 'adherent3@example.org', 'adherent4@example.org',
    ]);
  });

  /* Une trace FAILED dit que le relais a refusé : la personne n'a rien reçu, et
     une nouvelle tentative est exactement ce qu'il faut. */
  it('garde celui dont l\'envoi a été refusé', async () => {
    poserBase({ traces: [traceSent(0), traceFailed(1)] });

    const restants = await destinatairesRestants('panier-0001');

    expect(restants.map((r) => r.email)).toContain('adherent1@example.org');
  });

  // La trace d'un autre panier ne dit rien de celui-ci.
  it('ne confond pas deux paniers', async () => {
    poserBase({ traces: [{ kind: 'WEEKLY_BASKET', status: 'SENT', ref: 'panier-9999', to: 'adherent0@example.org' }] });

    expect(await destinatairesRestants('panier-0001')).toHaveLength(5);
  });
});

describe('La diffusion écrit son résultat là où l\'écran le lit', () => {
  it('recompte depuis EmailLog plutôt que d\'additionner', async () => {
    poserBase({ traces: [traceSent(0), traceFailed(4)] });

    const restants = await destinatairesRestants('panier-0001');
    await diffuserPanier({ basket: base.paniers[0], recipients: restants });

    /* Ce passage n'a écrit qu'à quatre personnes — le cinquième avait déjà sa
       trace. Le compteur en annonce cinq quand même : il porte l'histoire
       entière, pas le dernier passage. Écrire le résultat de la boucle, comme
       le fait la newsletter, perdrait le servi d'avant à chaque reprise. */
    expect(restants).toHaveLength(4);
    expect(base.paniers[0].notifiedCount).toBe(5);
    expect(base.paniers[0].notifyFailedCount).toBe(1);
  });

  it('relâche le drapeau en terminant', async () => {
    await reserverNotification('panier-0001');
    expect(base.paniers[0].notifyingSince).toBeInstanceOf(Date);

    await diffuserPanier({ basket: base.paniers[0], recipients: await destinatairesRestants('panier-0001') });

    expect(base.paniers[0].notifyingSince).toBeNull();
  });
});

describe('Le drapeau de diffusion', () => {
  it('se refuse à une seconde boucle pendant qu\'une tourne', async () => {
    expect(await reserverNotification('panier-0001')).toBe(true);
    expect(await reserverNotification('panier-0001')).toBe(false);
  });

  /* Sans cette reprise, un processus mort pendant la boucle laisserait le
     drapeau levé pour toujours et le panier ne serait jamais terminé. */
  it('se reprend quand il est plus vieux que le sursis', async () => {
    poserBase({ notifyingSince: ilYA(3 * HEURES) });

    expect(await reserverNotification('panier-0001')).toBe(true);
  });
});

describe('La reprise après un processus mort', () => {
  it('écrit aux abandonnés, et à eux seuls', async () => {
    // La boucle est morte après deux destinataires, drapeau resté levé.
    poserBase({ notifyingSince: ilYA(3 * HEURES), traces: [traceSent(0), traceSent(1)] });

    await reprendreNotificationsPaniers();

    expect(envois).toHaveLength(1);
    expect(envois[0].adresses).toEqual([
      'adherent2@example.org', 'adherent3@example.org', 'adherent4@example.org',
    ]);
    expect(base.paniers[0].notifiedCount).toBe(5);
    expect(base.paniers[0].notifyingSince).toBeNull();
    expect(journal.join('\n')).toContain('3 abonné(s) n\'avaient rien reçu');
  });

  it('ne touche pas à un panier déjà complet', async () => {
    poserBase({ traces: [0, 1, 2, 3, 4].map(traceSent) });

    await reprendreNotificationsPaniers();

    expect(envois).toHaveLength(0);
  });

  it('laisse tranquille une boucle encore vivante', async () => {
    poserBase({ notifyingSince: ilYA(2 * 60 * 1000) });

    await reprendreNotificationsPaniers();

    expect(envois).toHaveLength(0);
  });

  /* La borne n'est pas une durée mais un événement : passé la distribution,
     « voici ce que vous aurez mercredi » n'annonce plus rien. */
  it('n\'annonce pas un panier dont la distribution a eu lieu', async () => {
    poserBase({ distributionDate: ilYA(24 * HEURES), notifyingSince: ilYA(3 * HEURES) });

    await reprendreNotificationsPaniers();

    expect(envois).toHaveLength(0);
  });

  it('ignore un panier resté en brouillon', async () => {
    poserBase({ isPublished: false });

    await reprendreNotificationsPaniers();

    expect(envois).toHaveLength(0);
  });

  // Deux passages de suite : le second n'a plus rien à faire.
  it('s\'arrête d\'elle-même une fois la liste épuisée', async () => {
    poserBase({ notifyingSince: ilYA(3 * HEURES), traces: [traceSent(0)] });

    await reprendreNotificationsPaniers();
    await reprendreNotificationsPaniers();

    expect(envois).toHaveLength(1);
    expect(base.paniers[0].notifiedCount).toBe(5);
  });
});
