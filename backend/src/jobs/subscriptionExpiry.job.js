/* CLÔTURE DES ABONNEMENTS ÉCHUS

   Le statut EXPIRED existait dans le schéma sans que rien ne l'écrive : un
   contrat arrivé à son terme restait ACTIVE pour toujours. Les distributions
   étaient protégées — elles filtrent sur endDate —, mais pas le reste. Le
   tableau de bord comptait l'adhérent parmi les actifs, l'engagement financier
   additionnait le prix d'un contrat terminé, et surtout l'approbation d'une
   nouvelle demande se heurtait à « cet utilisateur a déjà un abonnement
   actif » : l'adhérent recevait le rappel de renouvellement, faisait sa
   demande, et personne ne pouvait la valider. */

import { prisma } from '../config/database.js';
import { logAudit } from '../services/audit.service.js';
import emailService from '../services/email.service.js';

const CLOTURABLES = ['ACTIVE', 'PAUSED'];

/* Passé ce délai, on clôture sans écrire : à la mise en service, la base porte
   des contrats échus depuis des saisons entières, et personne n'a envie
   d'apprendre la fin d'un abonnement de l'an dernier. */
const AVIS_MAX_MS = 7 * 24 * 60 * 60 * 1000;

export async function expireEndedSubscriptions() {
  try {
    const now = new Date();

    const echus = await prisma.subscription.findMany({
      where: { status: { in: CLOTURABLES }, endDate: { lt: now } },
      select: {
        id: true,
        subscriptionNumber: true,
        status: true,
        type: true,
        endDate: true,
        user: { select: { id: true, email: true, firstName: true } },
      },
    });

    if (echus.length === 0) return;

    let clos = 0;

    for (const subscription of echus) {
      /* Le statut est filtré dans le where : si un administrateur vient
         d'annuler ce contrat, la mise à jour ne touche aucune ligne et l'on
         n'écrit ni entrée d'audit ni message. */
      const claimed = await prisma.subscription.updateMany({
        where: { id: subscription.id, status: { in: CLOTURABLES } },
        data: { status: 'EXPIRED' },
      });

      if (claimed.count === 0) continue;

      await logAudit(
        null,
        'UPDATE_SUBSCRIPTION_STATUS',
        'IMPORTANT',
        { type: 'SUBSCRIPTION', id: subscription.id, label: subscription.subscriptionNumber },
        { from: subscription.status, to: 'EXPIRED', reason: 'Échéance atteinte' }
      );

      if (now - subscription.endDate <= AVIS_MAX_MS) {
        await emailService.sendSubscriptionExpired(subscription, subscription.user);
      }

      clos++;
    }

    console.log(`[ExpiryJob] ${clos}/${echus.length} abonnement(s) clos à échéance`);
  } catch (error) {
    console.error('[ExpiryJob] Erreur lors de la clôture des abonnements échus :', error);
  }
}

/* Quotidien : une échéance est une date, pas une heure, et un jour de retard ne
   coûte aucun panier — les listes de distribution bornent déjà sur endDate. */
export function startSubscriptionExpiryJob() {
  expireEndedSubscriptions();
  setInterval(expireEndedSubscriptions, 24 * 60 * 60 * 1000);

  console.log('[ExpiryJob] Job de clôture des abonnements échus démarré (vérification quotidienne)');
}
