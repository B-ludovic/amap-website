/* Le planificateur des jobs et sa route. Ce qu'ils verrouillent : un job ne
   tourne qu'une fois par période quel que soit le nombre de réveils, la purge
   attend une heure après un déploiement mais pas après un simple réveil, et une
   panne se lit dans le cahier de bord au lieu d'être avalée. */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';

const { cahier, base, appels, pannes, tache } = vi.hoisted(() => {
  const appels = [];
  const pannes = new Set();

  return {
    cahier: new Map(),
    base: { injoignable: false },
    appels,
    pannes,
    tache: (nom) => async () => {
      appels.push(nom);
      if (pannes.has(nom)) throw new Error(`${nom} en panne`);
    },
  };
});

/* Le cahier en mémoire ne connaît que les filtres qu'écrit le planificateur.
   `not` exclut null comme en SQL, et chaque updateMany s'exécute d'un bloc :
   c'est ce qui en fait un compare-and-set. */
vi.mock('../../src/config/database.js', () => {
  const correspond = (ligne, where) => Object.entries(where).every(([champ, cond]) => {
    if (champ === 'OR') return cond.some((c) => correspond(ligne, c));
    const valeur = ligne[champ];
    if (cond === null) return valeur === null;
    if (typeof cond !== 'object') return valeur === cond;
    if ('lte' in cond) return valeur !== null && valeur <= cond.lte;
    if ('not' in cond) return valeur !== null && valeur !== cond.not;
    throw new Error(`Filtre non simulé sur ${champ}`);
  });

  const verifierBase = () => {
    if (base.injoignable) throw new Error('base injoignable');
  };

  return {
    prisma: {
      jobRun: {
        createMany: async ({ data }) => {
          verifierBase();
          for (const ligne of data) {
            if (!cahier.has(ligne.name)) {
              cahier.set(ligne.name, { startedAt: null, finishedAt: null, status: null, error: null, ...ligne });
            }
          }
        },
        updateMany: async ({ where, data }) => {
          verifierBase();
          const lignes = [...cahier.values()].filter((ligne) => correspond(ligne, where));
          lignes.forEach((ligne) => Object.assign(ligne, data));
          return { count: lignes.length };
        },
        update: async ({ where, data }) => Object.assign(cahier.get(where.name), data),
      },
    },
  };
});

vi.mock('../../src/jobs/scheduledNewsletter.job.js', () => ({ envoyerNewslettersProgrammees: tache('newsletters-programmees') }));
vi.mock('../../src/jobs/pauseResume.job.js', () => ({ applyPauseTransitions: tache('pauses') }));
vi.mock('../../src/jobs/weeklyBasketGeneration.job.js', () => ({ generateNextWeeklyBasket: tache('generation-panier') }));
vi.mock('../../src/jobs/weeklyBasketNotify.job.js', () => ({ reprendreNotificationsPaniers: tache('reprise-annonce-panier') }));
vi.mock('../../src/jobs/orphanFlags.job.js', () => ({ releaseOrphanFlags: tache('drapeaux-orphelins') }));
vi.mock('../../src/jobs/chequeReminder.job.js', () => ({ checkChequeReminders: tache('rappels-cheques') }));
vi.mock('../../src/jobs/renewalReminder.job.js', () => ({ checkRenewalReminders: tache('rappels-renouvellement') }));
vi.mock('../../src/jobs/subscriptionExpiry.job.js', () => ({ expireEndedSubscriptions: tache('cloture-abonnements') }));
vi.mock('../../src/jobs/dataRetention.job.js', () => ({ runRetentionJob: tache('retention-rgpd') }));

const { runDueJobs, startScheduler, JOBS } = await import('../../src/jobs/scheduler.js');
const { runJobsTick } = await import('../../src/controllers/jobs.controller.js');

const MINUTE = 60 * 1000;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;

const T0 = new Date('2026-10-07T06:00:00Z');
const plus = (ms, depuis = T0) => new Date(depuis.getTime() + ms);

const TOUS = JOBS.map(({ nom }) => nom);
const HORAIRES = ['pauses', 'generation-panier', 'reprise-annonce-panier', 'drapeaux-orphelins'];

let journal;

beforeEach(() => {
  cahier.clear();
  appels.length = 0;
  pannes.clear();
  base.injoignable = false;
  vi.stubEnv('RENDER_GIT_COMMIT', 'version-a');

  journal = [];
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation((...a) => journal.push(a.join(' ')));
  vi.spyOn(console, 'error').mockImplementation((...a) => journal.push(a.join(' ')));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('Le cahier de bord décide de ce qui est dû', () => {
  it('un premier passage lance tout, sauf la purge qui attend une heure après la mise en ligne', async () => {
    const { lances } = await runDueJobs(T0);

    expect(lances).toEqual(TOUS.filter((nom) => nom !== 'retention-rgpd'));
    expect(appels).toEqual(lances);
  });

  it('un réveil cinq minutes plus tard ne relance rien', async () => {
    await runDueJobs(T0);

    const { lances } = await runDueJobs(plus(5 * MINUTE));

    expect(lances).toEqual([]);
  });

  it('une heure plus tard, relance les horaires et libère la purge, pas les quotidiens', async () => {
    await runDueJobs(T0);

    const { lances } = await runDueJobs(plus(HEURE));

    expect(lances).toEqual(['newsletters-programmees', ...HORAIRES, 'retention-rgpd']);
  });

  it('un passage arrivé quelques minutes en avance ne reporte pas le job d\'un cycle', async () => {
    await runDueJobs(T0);

    expect((await runDueJobs(plus(55 * MINUTE))).lances).toEqual(expect.arrayContaining(HORAIRES));
  });

  it('un passage à mi-période ne relance pas les jobs horaires', async () => {
    await runDueJobs(T0);

    const { lances } = await runDueJobs(plus(45 * MINUTE));

    expect(lances).toEqual(['newsletters-programmees']);
  });
});

describe('La purge attend une heure après un déploiement, pas après un réveil', () => {
  it('un réveil sans nouvelle version la laisse partir dès qu\'elle est due', async () => {
    await runDueJobs(T0);
    await runDueJobs(plus(HEURE));

    const { lances } = await runDueJobs(plus(HEURE + JOUR));

    expect(lances).toContain('retention-rgpd');
  });

  it('une nouvelle version la retient une heure, même quand elle est due', async () => {
    await runDueJobs(T0);
    await runDueJobs(plus(HEURE));

    vi.stubEnv('RENDER_GIT_COMMIT', 'version-b');
    const deploiement = plus(HEURE + JOUR);

    expect((await runDueJobs(deploiement)).lances).not.toContain('retention-rgpd');
    expect((await runDueJobs(plus(30 * MINUTE, deploiement))).lances).not.toContain('retention-rgpd');
    expect((await runDueJobs(plus(HEURE, deploiement))).lances).toContain('retention-rgpd');
  });
});

describe('Deux passages croisés ne lancent jamais le même job deux fois', () => {
  it('chaque job dû part une seule fois', async () => {
    const [a, b] = await Promise.all([runDueJobs(T0), runDueJobs(T0)]);

    expect([...a.lances, ...b.lances].sort()).toEqual(TOUS.filter((nom) => nom !== 'retention-rgpd').sort());
    expect(appels).toHaveLength(TOUS.length - 1);
  });
});

describe('Un job en panne est consigné sans arrêter les autres', () => {
  it('note l\'échec et son message, puis laisse tourner les jobs suivants', async () => {
    pannes.add('pauses');

    const bilan = await runDueJobs(T0);

    expect(bilan.echoues).toEqual(['pauses']);
    expect(cahier.get('pauses')).toMatchObject({ status: 'FAILED', error: 'pauses en panne' });
    expect(bilan.lances).toContain('cloture-abonnements');
    expect(cahier.get('cloture-abonnements').status).toBe('SUCCEEDED');
    expect(journal.join('\n')).toContain('[Planificateur] pauses a échoué');
  });

  it('retente le job au cycle suivant et efface le message d\'échec', async () => {
    pannes.add('pauses');
    await runDueJobs(T0);
    pannes.clear();

    await runDueJobs(plus(HEURE));

    expect(cahier.get('pauses')).toMatchObject({ status: 'SUCCEEDED', error: null });
  });
});

describe('Le démarrage survit à une base injoignable', () => {
  it('capture l\'échec du passage et reprend au suivant', async () => {
    vi.useFakeTimers();
    base.injoignable = true;

    startScheduler();
    await vi.advanceTimersByTimeAsync(0);

    expect(journal.join('\n')).toContain('[Planificateur] Passage interrompu');
    expect(appels).toEqual([]);

    base.injoignable = false;
    await vi.advanceTimersByTimeAsync(15 * MINUTE);

    expect(appels).toContain('pauses');

    vi.clearAllTimers();
    vi.useRealTimers();
  });
});

describe('La route de l\'horloge externe', () => {
  const SECRET = process.env.JOBS_SECRET;
  const tick = (authorization) => appeler(runJobsTick, { headers: authorization ? { authorization } : {} });

  it('refuse un appel sans secret', async () => {
    const { statut } = await tick();

    expect(statut).toBe(401);
    expect(appels).toEqual([]);
  });

  it('refuse un secret faux, même de la bonne longueur', async () => {
    const { statut } = await tick(`Bearer ${'x'.repeat(SECRET.length)}`);

    expect(statut).toBe(401);
    expect(appels).toEqual([]);
  });

  it('refuse tout quand JOBS_SECRET n\'est pas posé', async () => {
    vi.stubEnv('JOBS_SECRET', '');

    const { statut } = await tick('Bearer ');

    expect(statut).toBe(401);
    expect(appels).toEqual([]);
  });

  it('lance les jobs dus et rend le bilan', async () => {
    const { statut, corps } = await tick(`Bearer ${SECRET}`);

    expect(statut).toBe(200);
    expect(corps.data.lances).toHaveLength(TOUS.length - 1);
    expect(corps.data.echoues).toEqual([]);
  });

  it('répond 500 quand un job a échoué, pour que l\'horloge le signale', async () => {
    pannes.add('rappels-cheques');

    const { statut, corps } = await tick(`Bearer ${SECRET}`);

    expect(statut).toBe(500);
    expect(corps.data.echoues).toEqual(['rappels-cheques']);
  });
});
