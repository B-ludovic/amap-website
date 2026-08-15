/* Terminer une annonce de panier que le processus n'a pas fini d'envoyer.

   Mercredi 8 h 15, cent quatre-vingts abonnés. L'administratrice publie, la page
   répond, la boucle part. Au quarantième destinataire, un redéploiement coupe le
   processus. Cent quarante adhérents ne sauront pas ce qu'il y a dans le panier,
   et rien dans l'application ne le dit.

   Ce balayage relit EmailLog, retrouve ceux qui n'ont pas été servis, et leur
   écrit. Il ne double personne : une adresse déjà servie a sa ligne, elle sort
   de la liste.

   Pourquoi un job à part et non une branche d'orphanFlags : celui-là ne poste
   jamais rien, il relâche des drapeaux pour qu'un autre réessaie. Poster est un
   geste d'une autre nature, il mérite son propre fichier et son propre nom dans
   les logs.

   La borne n'est pas une durée mais un événement : on ne reprend que si la
   distribution n'a pas encore eu lieu. Passé mercredi 16 h, « voici ce que vous
   aurez mercredi » n'a plus rien à annoncer, et vaut mieux non envoyé. */

import { prisma } from '../config/database.js';
import {
  reserverNotification,
  destinatairesRestants,
  diffuserPanier,
} from '../services/weeklyBasketDispatch.service.js';

const itemsInclude = {
  items: {
    include: { product: { select: { name: true } } },
    orderBy: { id: 'asc' },
  },
};

export async function reprendreNotificationsPaniers() {
  try {
    const candidats = await prisma.weeklyBasket.findMany({
      where: {
        isPublished: true,
        distributionDate: { gte: new Date() },
      },
      include: itemsInclude,
    });

    for (const panier of candidats) {
      const restants = await destinatairesRestants(panier.id);

      if (restants.length === 0) continue;

      /* Le drapeau tranche : s'il est tenu par une boucle vivante, la
         réservation échoue et on passe au suivant. C'est aussi ce qui empêche
         deux instances de reprendre le même panier. */
      if (!await reserverNotification(panier.id)) continue;

      console.warn(`[PanierNotify] Panier ${panier.id} repris : ${restants.length} abonné(s) n'avaient rien reçu`);

      await diffuserPanier({ basket: panier, recipients: restants });
    }
  } catch (error) {
    console.error('[PanierNotify] Erreur lors de la reprise des notifications :', error);
  }
}

// Le passage au démarrage est le plus utile : la panne est presque toujours un
// redéploiement.
export function startWeeklyBasketNotifyJob() {
  reprendreNotificationsPaniers();
  setInterval(reprendreNotificationsPaniers, 60 * 60 * 1000);

  console.log('[PanierNotify] Reprise des notifications de panier active (toutes les heures)');
}
