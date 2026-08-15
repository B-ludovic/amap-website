import { prisma } from '../config/database.js';
import { logAudit } from '../services/audit.service.js';

/* REPRISE DES ABONNEMENTS EN PAUSE

   Une pause a une date de fin, donc l'abonnement doit repartir tout seul. Ce
   réveil se faisait jusqu'ici dans la liste des abonnements de l'administration :
   la lecture de la page repérait les pauses expirées et les réactivait au
   passage. Un GET qui écrit, avec deux conséquences.

   La première est que la page ne voit que la page. La reprise s'appliquait aux
   vingt abonnements chargés, jamais aux autres : un contrat dont la pause avait
   expiré, mais rangé en page 4 du tableau, restait en pause aussi longtemps que
   personne n'ouvrait la page 4. Le réveil dépendait donc de la navigation d'un
   bénévole, pas du calendrier.

   La seconde est qu'un changement de statut d'un contrat — l'état qui décide si
   un panier est dû cette semaine — ne laissait aucune trace dans le journal
   d'audit, alors que la mise en pause et la reprise manuelle en laissent une.

   Le réveil est donc devenu ce qu'il aurait dû être : un passage quotidien qui
   regarde toute la base, pas la fenêtre qu'un écran vient d'ouvrir. */

async function resumeExpiredPauses() {
  try {
    const now = new Date();

    /* Les contrats en pause dont plus aucune pause ne court : au moins une
       pause terminée, et aucune qui s'étende encore jusqu'à aujourd'hui. La
       seconde condition suffirait presque, mais elle réveillerait aussi un
       contrat marqué en pause sans qu'aucune pause ne soit enregistrée — une
       incohérence qu'il vaut mieux laisser visible que réparer en silence. */
    const toResume = await prisma.subscription.findMany({
      where: {
        status: 'PAUSED',
        pauses: {
          some: { endDate: { lt: now } },
          none: { endDate: { gte: now } }
        }
      },
      select: { id: true, subscriptionNumber: true }
    });

    // Le cas courant est qu'il n'y ait rien à faire : on ne l'écrit pas dans les
    // logs, sans quoi le passage horaire noierait les lignes qui comptent.
    if (toResume.length === 0) return;

    let resumed = 0;

    for (const subscription of toResume) {
      /* Le statut est filtré dans le where et non seulement lu au préalable :
         si un administrateur vient de reprendre ce contrat à la main, la mise à
         jour ne touche aucune ligne et l'on n'écrit pas une seconde entrée
         d'audit pour une reprise qui a déjà eu lieu. */
      const claimed = await prisma.subscription.updateMany({
        where: { id: subscription.id, status: 'PAUSED' },
        data: { status: 'ACTIVE' }
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

      resumed++;
    }

    console.log(`[PauseJob] ${resumed}/${toResume.length} abonnement(s) réactivé(s)`);
  } catch (error) {
    console.error('[PauseJob] Erreur lors de la reprise des abonnements en pause :', error);
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
  resumeExpiredPauses();

  setInterval(resumeExpiredPauses, CHECK_INTERVAL_MS);

  console.log('[PauseJob] Job de reprise des abonnements démarré (vérification horaire)');
}
