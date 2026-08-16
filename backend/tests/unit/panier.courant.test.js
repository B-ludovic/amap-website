/* Quel panier la page publique montre-t-elle, et jusqu'à quand.

   La date de distribution est enregistrée à midi UTC. Comparée à l'instant
   courant, elle faisait sortir le panier du mercredi dès le début de
   l'après-midi — avant la distribution qu'il annonce, à 18h15. Le panier
   suivant n'étant créé que le jeudi à 2 h, la page tombait entre-temps sur son
   écran vide, mot de la semaine compris.

   La comparaison porte donc sur le jour civil : le panier du mercredi reste
   courant toute sa journée. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';

const { etat } = vi.hoisted(() => ({ etat: { paniers: [] } }));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    weeklyBasket: {
      /* Ce que fait Prisma : filtrer, trier, prendre le premier. */
      findFirst: async ({ where, orderBy }) => {
        const retenus = etat.paniers
          .filter(panier => panier.isPublished === where.isPublished)
          .filter(panier => panier.distributionDate >= where.distributionDate.gte)
          .sort((a, b) => (orderBy.distributionDate === 'asc'
            ? a.distributionDate - b.distributionDate
            : b.distributionDate - a.distributionDate));

        return retenus[0] ?? null;
      },
    },
  },
}));

const { getCurrentWeeklyBasket } = await import('../../src/controllers/weekly-baskets.controller.js');

/* Le mercredi 19 août 2026, jour de distribution. Le job enregistre la date à
   midi UTC ; la remise des paniers a lieu de 18h15 à 19h15, heure de Paris. */
const MERCREDI = new Date(Date.UTC(2026, 7, 19, 12));
const MERCREDI_SUIVANT = new Date(Date.UTC(2026, 7, 26, 12));

function panier(distributionDate, id) {
  return { id, distributionDate, isPublished: true, items: [], notes: 'Les tomates sont là.' };
}

function figerLHeure(instant) {
  vi.useFakeTimers();
  vi.setSystemTime(instant);
}

beforeEach(() => {
  vi.useRealTimers();
  etat.paniers = [panier(MERCREDI, 'semaine-34'), panier(MERCREDI_SUIVANT, 'semaine-35')];
});

describe('panier de la semaine — jusqu\'à quand il reste courant', () => {
  it('montre encore le panier du jour pendant la distribution', async () => {
    // Mercredi 18h30 à Paris, soit 16h30 UTC : la remise est en cours.
    figerLHeure(new Date(Date.UTC(2026, 7, 19, 16, 30)));

    const res = await appeler(getCurrentWeeklyBasket, { query: {} });

    expect(res.corps.data?.id).toBe('semaine-34');
  });

  it('le montre encore en fin de soirée, après la distribution', async () => {
    figerLHeure(new Date(Date.UTC(2026, 7, 19, 21, 45)));

    const res = await appeler(getCurrentWeeklyBasket, { query: {} });

    expect(res.corps.data?.id).toBe('semaine-34');
  });

  it('bascule sur le suivant une fois le jour de distribution passé', async () => {
    // Jeudi 3h à Paris : le job a généré le panier de la semaine d'après.
    figerLHeure(new Date(Date.UTC(2026, 7, 20, 1)));

    const res = await appeler(getCurrentWeeklyBasket, { query: {} });

    expect(res.corps.data?.id).toBe('semaine-35');
  });

  it('montre déjà le panier à venir les jours qui précèdent', async () => {
    figerLHeure(new Date(Date.UTC(2026, 7, 17, 9)));

    const res = await appeler(getCurrentWeeklyBasket, { query: {} });

    expect(res.corps.data?.id).toBe('semaine-34');
  });

  it('répond sans panier plutôt qu\'en erreur quand aucun n\'est publié', async () => {
    etat.paniers = [];
    figerLHeure(new Date(Date.UTC(2026, 7, 19, 16, 30)));

    const res = await appeler(getCurrentWeeklyBasket, { query: {} });

    expect(res.corps.success).toBe(true);
    expect(res.corps.data).toBeNull();
  });
});
