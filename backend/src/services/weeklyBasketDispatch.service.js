/* La notification du panier de la semaine, hors de la requête qui l'a publiée.

   Même forme que newsletterDispatch, sauf sur un point qui change tout : ici la
   reprise reprend, là-bas elle clôt.

   Pour une newsletter, un envoi interrompu se referme sur le compte réel — la
   relancer réécrirait aux premiers servis, et mieux vaut en rater un qu'en
   doubler un. Pour un panier, EmailLog dit qui a déjà reçu : on peut donc
   écrire aux autres sans risque, et ça vaut la peine puisqu'un panier annoncé
   avec deux heures de retard reste la liste des courses de mercredi.

     publication ──> reserver() ──> 200
                         └──> diffuser() ─ lot ─> lot ─┐   (le processus meurt)
                                                       v
                          EmailLog ──> restants() ──> diffuser() ─ lot ─> lot
                                       (au redémarrage)

   La reprise s'arrête d'elle-même : elle recalcule les restants à chaque
   passage, et la liste finit vide. */

import { prisma } from '../config/database.js';
import emailService from './email.service.js';

/* Au-delà, le processus qui tenait le drapeau est considéré mort. Large devant
   les quelques minutes que demande la plus longue boucle : reprendre trop tôt
   écrirait deux fois aux mêmes personnes, reprendre trop tard ne coûte qu'une
   heure d'attente. */
const GRACE_MS = 60 * 60 * 1000;

const ilYA = (ms) => new Date(Date.now() - ms);

/* Le drapeau se prend par écriture conditionnelle : deux instances qui balaient
   en même temps ne peuvent pas partir toutes les deux sur le même panier. Un
   drapeau plus vieux que le sursis est repris — c'est ce qui rend la reprise
   possible après un redéploiement. */
export async function reserverNotification(id) {
  const { count } = await prisma.weeklyBasket.updateMany({
    where: {
      id,
      OR: [
        { notifyingSince: null },
        { notifyingSince: { lte: ilYA(GRACE_MS) } },
      ],
    },
    data: { notifyingSince: new Date() },
  });

  return count === 1;
}

/* Qui n'a pas encore reçu ce panier.

   La question se pose à EmailLog et non à un compteur : un compteur dit combien,
   la reprise a besoin de savoir lesquels. Le rapprochement se fait sur l'adresse,
   seule donnée que les deux tables partagent — la trace d'envoi ne garde pas
   l'identifiant de l'abonné.

   Une trace FAILED ne compte pas comme servie : le message a été refusé, la
   personne n'a rien reçu, et une nouvelle tentative est exactement ce qu'il
   faut. */
export async function destinatairesRestants(basketId) {
  const [abonnements, dejaServis] = await Promise.all([
    prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      include: { user: { select: { firstName: true, email: true } } },
    }),
    prisma.emailLog.findMany({
      where: { kind: 'WEEKLY_BASKET', status: 'SENT', ref: basketId },
      select: { to: true },
      distinct: ['to'],
    }),
  ]);

  const servis = new Set(dejaServis.map((ligne) => ligne.to));

  return abonnements
    .map((abonnement) => abonnement.user)
    .filter((user) => user?.email && !servis.has(user.email));
}

/* Recompté depuis EmailLog plutôt qu'accumulé : après une reprise, une addition
   compterait deux fois les envois du premier passage. La table sait, elle. */
async function finaliser(id) {
  const [servis, refuses] = await Promise.all([
    prisma.emailLog.count({ where: { kind: 'WEEKLY_BASKET', status: 'SENT', ref: id } }),
    prisma.emailLog.count({ where: { kind: 'WEEKLY_BASKET', status: 'FAILED', ref: id } }),
  ]);

  await prisma.weeklyBasket.update({
    where: { id },
    data: { notifiedCount: servis, notifyFailedCount: refuses, notifyingSince: null },
  });

  return { servis, refuses };
}

/* À lancer sans l'attendre. Ne laisse échapper aucune exception : la réponse est
   déjà partie. Le drapeau est relâché dans tous les cas, sans quoi le panier
   attendrait une heure de sursis avant d'être repris pour rien. */
export async function diffuserPanier({ basket, recipients }) {
  try {
    if (recipients.length > 0) {
      await emailService.sendWeeklyBasketNotification(basket, recipients);
    }

    const { servis, refuses } = await finaliser(basket.id);

    if (refuses > 0) {
      console.warn(`[Panier ${basket.id}] ${refuses} abonné(s) non joint(s) sur ${servis + refuses} — voir EmailLog`);
    }

    return { servis, refuses };
  } catch (error) {
    console.error(`[Panier ${basket.id}] notification interrompue : ${error.message}`);

    await prisma.weeklyBasket
      .update({ where: { id: basket.id }, data: { notifyingSince: null } })
      .catch((releaseError) => console.error(`[Panier ${basket.id}] drapeau non relâché : ${releaseError.message}`));

    return { servis: 0, refuses: 0 };
  }
}

// Le `void` est délibéré, le .catch est une ceinture : un rejet arrêterait Node.
export function lancerNotification(params) {
  void diffuserPanier(params)
    .catch((error) => console.error(`[Panier ${params.basket.id}] notification non capturée : ${error.message}`));
}
