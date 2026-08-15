import { prisma } from '../config/database.js';
import emailService from '../services/email.service.js';

/* Les deux rappels du cycle du chèque.

   Un chèque remis en février et encaissé en septembre traverse sept mois pendant
   lesquels personne ne le regarde. Deux oublis guettent, de part et d'autre du
   guichet, et ce job répond aux deux :

     l'adhérent  ─ 30 jours avant l'échéance ─▶  « votre chèque de X part en
                                                  banque le 1er septembre »
     le trésorier ─  7 jours avant l'échéance ─▶  une liste unique, à emporter
                                                  à la banque

   Les deux dates diffèrent parce que les gestes diffèrent : approvisionner un
   compte demande un mois de préavis, préparer une remise demande une semaine.
   D'où deux colonnes de garde distinctes sur Payment — reminderSentAt et
   treasurerNotifiedAt — plutôt qu'une seule que le premier envoi éteindrait
   pour le second. */

const MEMBER_LEAD_DAYS = 30;
const TREASURER_LEAD_DAYS = 7;

/* Un chèque annoncé au trésorier mais toujours en pochette repasse dans le
   récapitulatif au bout de quinze jours. Sans cette relance, un chèque oublié
   sort de la liste après un seul message et n'y revient jamais — soit
   exactement l'oubli que ce job existe pour empêcher. Quinze jours plutôt
   qu'un : un rappel quotidien finit dans la corbeille sans être lu. */
const TREASURER_RELANCE_DAYS = 15;

const joursApres = (date, jours) => {
  const resultat = new Date(date);
  resultat.setDate(resultat.getDate() + jours);
  return resultat;
};

/* ── Rappel à l'adhérent ─────────────────────────────────────────────────── */

async function remindMembers(now) {
  const horizon = joursApres(now, MEMBER_LEAD_DAYS);

  const payments = await prisma.payment.findMany({
    where: {
      status: 'RECEIVED',
      /* Borne basse volontaire : une échéance déjà passée ne donne pas lieu à
         un avis. « Votre chèque sera déposé le 1er juin » envoyé le 15 juin ne
         prévient de rien, il inquiète. */
      dueDate: { gte: now, lte: horizon },
      reminderSentAt: null,
      subscription: { status: { in: ['ACTIVE', 'PAUSED'] } },
    },
    include: {
      subscription: {
        select: {
          id: true,
          subscriptionNumber: true,
          user: { select: { email: true, firstName: true } },
          // Toute la remise, pour situer ce chèque : « le 3e sur 4 ».
          payments: { select: { id: true }, orderBy: { dueDate: 'asc' } },
        },
      },
    },
  });

  let envoyes = 0;
  let echecs = 0;
  for (const payment of payments) {
    const { subscription } = payment;
    const total = subscription.payments.length;

    /* Chèque unique : son échéance tombe au mois de démarrage, donc ce rappel
       partirait à peu près le jour de la signature, quand l'adhérent vient
       justement de le remettre. On se tait. */
    if (total <= 1) continue;

    /* Le drapeau est posé AVANT l'envoi. Le updateMany filtré sur
       reminderSentAt: null est un compare-and-set arbitré par la base : deux
       instances du job ne peuvent pas envoyer le même avis. Un email parti ne
       se reprend pas, on préfère en rater un qu'en doubler un. */
    const claimed = await prisma.payment.updateMany({
      where: { id: payment.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (claimed.count === 0) continue;

    const result = await emailService.sendChequeDepositNotice({
      payment,
      subscription,
      user: subscription.user,
      rang: subscription.payments.findIndex((p) => p.id === payment.id) + 1,
      total,
    });

    if (result.success) {
      envoyes++;
    } else {
      // Échec d'envoi : on relâche le drapeau pour retenter demain.
      echecs++;
      await prisma.payment.update({
        where: { id: payment.id },
        data: { reminderSentAt: null },
      });
      console.error(`[ChequeJob] Échec avis ${subscription.subscriptionNumber}:`, result.error);
    }
  }

  /* On ne compte pas les contrats à chèque unique dans le total affiché : ils
     repassent dans la requête tous les jours — rien ne les en sort, puisque
     poser reminderSentAt sur un avis qu'on a choisi de ne pas envoyer serait
     écrire un mensonge en base. Les inclure ferait afficher « 0/1 envoyés »
     chaque matin, ce qui se lit comme une panne. */
  if (envoyes + echecs > 0) {
    console.log(`[ChequeJob] ${envoyes}/${envoyes + echecs} avis d'encaissement envoyés`);
  }
}

/* ── Récapitulatif au trésorier ──────────────────────────────────────────── */

async function remindTreasurer(now) {
  if (!process.env.TREASURER_EMAIL) return;

  const horizon = joursApres(now, TREASURER_LEAD_DAYS);
  const seuilRelance = joursApres(now, -TREASURER_RELANCE_DAYS);
  const debutDuJour = new Date(now);
  debutDuJour.setHours(0, 0, 0, 0);

  /* Tout ce qui est actionnable, sans borne basse cette fois : un chèque en
     retard reste à déposer, il ouvre même la liste.

     Un contrat annulé est le seul écarté — ses chèques doivent revenir à
     l'adhérent, pas partir à la banque. Un contrat expiré, lui, garde ses
     chèques dus : la saison a été livrée, l'argent est dû. */
  const enAttente = await prisma.payment.findMany({
    where: {
      status: 'RECEIVED',
      dueDate: { lte: horizon },
      subscription: { status: { not: 'CANCELLED' } },
    },
    include: {
      subscription: {
        select: {
          subscriptionNumber: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  });

  /* Ce qui déclenche l'envoi : les chèques jamais annoncés, plus ceux annoncés
     il y a plus de quinze jours et toujours en pochette. Le contenu de l'email,
     lui, reprend la liste entière — le trésorier a besoin de la remise
     complète, pas seulement des nouveautés. */
  const aSignaler = enAttente.filter((payment) => (
    payment.treasurerNotifiedAt === null || payment.treasurerNotifiedAt <= seuilRelance
  ));
  if (aSignaler.length === 0) return;

  const claimed = await prisma.payment.updateMany({
    where: {
      id: { in: aSignaler.map((payment) => payment.id) },
      OR: [{ treasurerNotifiedAt: null }, { treasurerNotifiedAt: { lte: seuilRelance } }],
    },
    data: { treasurerNotifiedAt: now },
  });
  if (claimed.count === 0) return; // Une autre instance a pris la remise.

  const result = await emailService.sendTreasurerChequeDigest(
    enAttente.map((payment) => ({
      nom: `${payment.subscription.user.firstName} ${payment.subscription.user.lastName}`,
      subscriptionNumber: payment.subscription.subscriptionNumber,
      amount: payment.amount,
      dueDate: payment.dueDate,
      checkNumber: payment.checkNumber,
      enRetard: payment.dueDate < debutDuJour,
    }))
  );

  if (result.success) {
    console.log(`[ChequeJob] Récapitulatif trésorier envoyé : ${enAttente.length} chèque(s), dont ${aSignaler.length} à signaler`);
    return;
  }

  /* Échec d'envoi : chaque ligne retrouve sa date précédente, et non null.
     Remettre null ferait passer une relance pour une première annonce, ce qui
     réarmerait aussitôt le compte à rebours des quinze jours. */
  await prisma.$transaction(aSignaler.map((payment) => prisma.payment.update({
    where: { id: payment.id },
    data: { treasurerNotifiedAt: payment.treasurerNotifiedAt },
  })));
  console.error('[ChequeJob] Échec récapitulatif trésorier:', result.error);
}

/* Exportée pour être déclenchable seule — le job périodique n'est qu'un
   ordonnanceur, la logique est ici. */
export async function checkChequeReminders() {
  try {
    const now = new Date();
    await remindMembers(now);
    await remindTreasurer(now);
  } catch (error) {
    console.error('[ChequeJob] Erreur lors de la vérification des chèques:', error);
  }
}

export function startChequeReminderJob() {
  checkChequeReminders();
  setInterval(checkChequeReminders, 24 * 60 * 60 * 1000);
  console.log('[ChequeJob] Job de rappel des chèques démarré (vérification quotidienne)');
}
