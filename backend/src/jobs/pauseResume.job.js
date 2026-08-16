import { prisma } from '../config/database.js';
import { logAudit } from '../services/audit.service.js';
import emailService from '../services/email.service.js';

/* ENTRÉE ET SORTIE DE PAUSE

   Une pause a deux bords, et les deux se franchissent sans que personne ne soit
   devant l'écran. La sortie se faisait jusqu'ici dans la liste des abonnements
   de l'administration : la lecture de la page repérait les pauses expirées et
   les réactivait au passage. Un GET qui écrit, avec deux conséquences.

   La première est que la page ne voit que la page. La reprise s'appliquait aux
   vingt abonnements chargés, jamais aux autres : un contrat dont la pause avait
   expiré, mais rangé en page 4 du tableau, restait en pause aussi longtemps que
   personne n'ouvrait la page 4. Le réveil dépendait donc de la navigation d'un
   bénévole, pas du calendrier.

   La seconde est qu'un changement de statut d'un contrat — l'état qui décide si
   un panier est dû cette semaine — ne laissait aucune trace dans le journal
   d'audit, alors que la mise en pause et la reprise manuelle en laissent une.

   Le passage est donc devenu ce qu'il aurait dû être : un balayage horaire qui
   regarde toute la base, pas la fenêtre qu'un écran vient d'ouvrir. */

const RECIPIENT_FIELDS = {
  user: { select: { id: true, email: true, firstName: true } },
  pickupLocation: true,
};

/* Les contrats dont une pause commence aujourd'hui. La saisie ne bascule le
   statut que si la pause court déjà : celles annoncées à l'avance attendent ici
   leur date, sans quoi prévenir tôt de ses vacances coûterait les paniers d'ici
   là. */
async function pauseStartingSubscriptions(now) {
  const toPause = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      pauses: { some: { startDate: { lte: now }, endDate: { gte: now } } },
    },
    select: { id: true, subscriptionNumber: true },
  });

  for (const subscription of toPause) {
    const claimed = await prisma.subscription.updateMany({
      where: { id: subscription.id, status: 'ACTIVE' },
      data: { status: 'PAUSED' },
    });

    if (claimed.count === 0) continue;

    await logAudit(
      null,
      'UPDATE_SUBSCRIPTION_STATUS',
      'IMPORTANT',
      { type: 'SUBSCRIPTION', id: subscription.id, label: subscription.subscriptionNumber },
      { from: 'ACTIVE', to: 'PAUSED', reason: 'Début de pause atteint' }
    );
  }

  // L'adhérent a déjà reçu les dates à l'enregistrement : rien à annoncer ici.
  return toPause.length;
}

/* Les contrats en pause dont plus aucune pause ne court : au moins une pause
   terminée, et aucune qui s'étende encore jusqu'à aujourd'hui. La seconde
   condition suffirait presque, mais elle réveillerait aussi un contrat marqué en
   pause sans qu'aucune pause ne soit enregistrée — une incohérence qu'il vaut
   mieux laisser visible que réparer en silence. */
async function resumeExpiredSubscriptions(now) {
  const toResume = await prisma.subscription.findMany({
    where: {
      status: 'PAUSED',
      pauses: {
        some: { endDate: { lt: now } },
        none: { endDate: { gte: now } },
      },
    },
    select: { id: true, subscriptionNumber: true, ...RECIPIENT_FIELDS },
  });

  let resumed = 0;

  for (const subscription of toResume) {
    /* Le statut est filtré dans le where et non seulement lu au préalable : si
       un administrateur vient de reprendre ce contrat à la main, la mise à jour
       ne touche aucune ligne, et l'on n'écrit ni seconde entrée d'audit ni
       second message pour une reprise qui a déjà eu lieu. */
    const claimed = await prisma.subscription.updateMany({
      where: { id: subscription.id, status: 'PAUSED' },
      data: { status: 'ACTIVE' },
    });

    if (claimed.count === 0) continue;

    /* Pas de requête Express ici : le journal enregistrera « système » comme
       auteur, ce qui est exactement ce qui s'est passé. */
    await logAudit(
      null,
      'UPDATE_SUBSCRIPTION_STATUS',
      'IMPORTANT',
      { type: 'SUBSCRIPTION', id: subscription.id, label: subscription.subscriptionNumber },
      { from: 'PAUSED', to: 'ACTIVE', reason: 'Fin de pause atteinte' }
    );

    // Sans ce message, un panier est préparé pour quelqu'un qui ignore que sa
    // pause s'achève.
    await emailService.sendSubscriptionResumed(subscription, subscription.user);

    resumed++;
  }

  return { resumed, candidats: toResume.length };
}

export async function applyPauseTransitions() {
  try {
    const now = new Date();

    const endormis = await pauseStartingSubscriptions(now);
    const { resumed, candidats } = await resumeExpiredSubscriptions(now);

    // Le cas courant est qu'il n'y ait rien à faire : on ne l'écrit pas dans les
    // logs, sans quoi le passage horaire noierait les lignes qui comptent.
    if (endormis > 0) console.log(`[PauseJob] ${endormis} abonnement(s) mis en pause`);
    if (candidats > 0) console.log(`[PauseJob] ${resumed}/${candidats} abonnement(s) réactivé(s)`);
  } catch (error) {
    console.error('[PauseJob] Erreur lors du suivi des pauses :', error);
  }
}

/* Horaire, et non quotidien comme les jobs de rappel voisins. Ceux-là envoient
   des e-mails, où quelques heures de décalage ne se voient pas ; ici c'est le
   statut du contrat qui est en jeu, et c'est lui qui décide si l'adhérent figure
   sur la liste de distribution. Une pause qui s'achève le mardi soir doit être
   levée avant la distribution du mercredi matin : avec un seul passage par jour,
   calé sur l'heure de démarrage du serveur, rien ne le garantit. Une requête
   indexée par heure ne coûte rien au regard d'un panier non préparé. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function startPauseResumeJob() {
  // Vérification immédiate au démarrage
  applyPauseTransitions();

  setInterval(applyPauseTransitions, CHECK_INTERVAL_MS);

  console.log('[PauseJob] Job de suivi des pauses démarré (vérification horaire)');
}
