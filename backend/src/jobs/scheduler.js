/* Le planificateur des neuf jobs.

   Trois portes y mènent : le démarrage du serveur, une minuterie tant qu'il est
   éveillé, et la route /api/jobs/tick qu'une horloge externe appelle pour le
   réveiller. Toutes posent la même question au cahier de bord (table JobRun) :
   quel job n'a pas tourné depuis sa période ? */

import { prisma } from '../config/database.js';
import { checkRenewalReminders } from './renewalReminder.job.js';
import { runRetentionJob } from './dataRetention.job.js';
import { generateNextWeeklyBasket } from './weeklyBasketGeneration.job.js';
import { checkChequeReminders } from './chequeReminder.job.js';
import { applyPauseTransitions } from './pauseResume.job.js';
import { releaseOrphanFlags } from './orphanFlags.job.js';
import { reprendreNotificationsPaniers } from './weeklyBasketNotify.job.js';
import { envoyerNewslettersProgrammees } from './scheduledNewsletter.job.js';
import { expireEndedSubscriptions } from './subscriptionExpiry.job.js';

const MINUTE = 60 * 1000;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;

export const JOBS = [
  { nom: 'newsletters-programmees', toutesLes: 15 * MINUTE, tache: envoyerNewslettersProgrammees },
  // Une pause qui s'achève le mardi soir doit être levée avant la distribution du mercredi.
  { nom: 'pauses', toutesLes: HEURE, tache: applyPauseTransitions },
  // Le job décide lui-même du jour : jeudi après 2 h, rattrapage jusqu'au mardi.
  { nom: 'generation-panier', toutesLes: HEURE, tache: () => generateNextWeeklyBasket() },
  { nom: 'reprise-annonce-panier', toutesLes: HEURE, tache: reprendreNotificationsPaniers },
  { nom: 'drapeaux-orphelins', toutesLes: HEURE, tache: releaseOrphanFlags },
  { nom: 'rappels-cheques', toutesLes: JOUR, tache: checkChequeReminders },
  { nom: 'rappels-renouvellement', toutesLes: JOUR, tache: checkRenewalReminders },
  { nom: 'cloture-abonnements', toutesLes: JOUR, tache: expireEndedSubscriptions },
  /* Seul job qui détruit : il attend une heure après chaque déploiement, le
     temps de vérifier la version mise en ligne avant qu'un filtre trop large
     efface quoi que ce soit. */
  { nom: 'retention-rgpd', toutesLes: JOUR, apresDeploiement: HEURE, tache: runRetentionJob },
];

// L'horloge externe n'est pas ponctuelle : un passage arrivé quelques minutes
// en avance ne doit pas reporter le job d'un cycle entier.
const AVANCE_TOLEREE = 0.1;

const ilYA = (now, ms) => new Date(now.getTime() - ms);

// Render fournit le commit déployé ; une valeur fixe en local suffit.
const versionEnLigne = () => process.env.RENDER_GIT_COMMIT || 'locale';

/* Un réveil de Render ne change pas la version : seul un vrai déploiement
   réarme l'attente de la purge. */
async function preparerCahier(now) {
  const version = versionEnLigne();

  await prisma.jobRun.createMany({
    data: JOBS.map(({ nom }) => ({ name: nom, version, versionSince: now })),
    skipDuplicates: true,
  });

  await prisma.jobRun.updateMany({
    where: { OR: [{ version: null }, { version: { not: version } }] },
    data: { version, versionSince: now },
  });
}

/* Compare-and-set arbitré par la base : deux passages croisés, ou deux
   instances, ne lancent jamais le même job deux fois. */
async function prendre(job, now) {
  const where = {
    name: job.nom,
    OR: [
      { startedAt: null },
      { startedAt: { lte: ilYA(now, job.toutesLes * (1 - AVANCE_TOLEREE)) } },
    ],
  };
  if (job.apresDeploiement) {
    where.versionSince = { lte: ilYA(now, job.apresDeploiement) };
  }

  const { count } = await prisma.jobRun.updateMany({
    where,
    data: { startedAt: now, status: 'RUNNING' },
  });

  return count === 1;
}

export async function runDueJobs(now = new Date()) {
  await preparerCahier(now);

  const bilan = { lances: [], echoues: [] };

  // Un job à la fois : la base gratuite n'a que quelques connexions.
  for (const job of JOBS) {
    if (!await prendre(job, now)) continue;

    bilan.lances.push(job.nom);

    try {
      await job.tache();
      await prisma.jobRun.update({
        where: { name: job.nom },
        data: { status: 'SUCCEEDED', finishedAt: new Date(), error: null },
      });
    } catch (error) {
      bilan.echoues.push(job.nom);
      console.error(`[Planificateur] ${job.nom} a échoué :`, error);
      await prisma.jobRun.update({
        where: { name: job.nom },
        data: { status: 'FAILED', finishedAt: new Date(), error: String(error?.message ?? error).slice(0, 1000) },
      });
    }
  }

  if (bilan.lances.length > 0) {
    console.log(`[Planificateur] ${bilan.lances.length - bilan.echoues.length}/${bilan.lances.length} job(s) terminé(s) : ${bilan.lances.join(', ')}`);
  }

  return bilan;
}

const INTERVALLE_EVEILLE = 15 * MINUTE;

export function startScheduler() {
  // Un rejet non capturé arrête Node : le serveur doit survivre à une base injoignable.
  const passer = () => runDueJobs().catch((error) => {
    console.error('[Planificateur] Passage interrompu :', error);
  });

  // D'abord au démarrage : sur Render gratuit, chaque réveil rattrape ce qui est dû.
  passer();
  setInterval(passer, INTERVALLE_EVEILLE);

  console.log('[Planificateur] Jobs dus lancés au démarrage, puis toutes les 15 minutes tant que le serveur est éveillé');
}
