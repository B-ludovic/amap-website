/* La diffusion d'une newsletter, hors de la requête qui l'a déclenchée.

   Pourquoi ce fichier existe. Envoyer à cinq cents adhérents demande plus de
   quatre minutes : chaque message rouvre une connexion vers Brevo, négocie TLS,
   s'authentifie, et le logo de l'en-tête repart à chaque fois. Tant que la
   boucle tournait dans le contrôleur, la requête de l'administratrice restait
   ouverte sans qu'un seul octet ne soit écrit, jusqu'à ce que le proxy de
   l'hébergeur coupe. Elle voyait alors une erreur réseau, croyait que rien
   n'était parti, recliquait — et cent trente personnes recevaient la lettre en
   double.

   La scène se joue à deux endroits : l'envoi manuel depuis l'écran de
   communication, et l'annonce automatique d'une fermeture de l'AMAP. Les deux
   passent donc par ici, plutôt que d'entretenir deux copies d'une même
   mécanique qui divergeraient à la première correction.

   Le déroulé, vu d'en haut :

     requête ──> réserver()  ──> 202 « c'est accepté »
                     │
                     └──> diffuser()  ─ lot ─> lot ─> lot ─┐
                              (en tâche de fond)           │
                                                           v
                                              statut + compteur en base
                                                           │
                              écran de communication <─────┘

   Personne n'attend la seconde branche. C'est en base, et là seulement, que
   l'administratrice lit ensuite où en est son envoi. */

import { prisma } from '../config/database.js';
import emailService from './email.service.js';
import { logAudit } from './audit.service.js';

/* Les états depuis lesquels un envoi peut partir.

   FAILED en fait partie au même titre que DRAFT : une tentative qui n'a atteint
   personne — un quota dépassé un matin de rentrée — ne condamne pas le texte,
   elle constate seulement qu'il faut recommencer. */
const ETATS_DE_DEPART = ['DRAFT', 'FAILED'];

/* Réserver la newsletter avant d'envoyer quoi que ce soit.

   Le updateMany filtré sur le statut de départ est un compare-and-set atomique :
   c'est la base qui arbitre entre deux requêtes concurrentes, pas l'application.
   Même motif que renewalReminder.job.js, pour la même raison — un e-mail parti
   ne se reprend pas, on préfère en rater un plutôt qu'en doubler un.

   Rend true si la réservation est acquise, false si quelqu'un est déjà passé. */
export async function reserverNewsletter(id) {
  const { count } = await prisma.newsletter.updateMany({
    where: { id, status: { in: ETATS_DE_DEPART } },
    data: { status: 'SENDING', sentAt: new Date(), sentCount: 0 },
  });

  return count === 1;
}

/* Ce qu'il advient de la newsletter une fois la boucle terminée.

   Deux issues. Ou bien au moins une boîte a reçu le message, et la newsletter
   est close : sentAt reste à l'heure du départ — le redater serait faux,
   l'envoi a commencé plusieurs minutes plus tôt — et le compte est inscrit. Ou
   bien aucune ne l'a reçu, et tout est relâché, ce qui la rend de nouveau
   modifiable et renvoyable.

   Une liste vide n'est pas un échec : il n'y avait personne à qui écrire, ce
   qui n'est pas la même chose qu'un envoi refusé. */
async function finaliser({ id, sent, failed, recipientsCount }) {
  const rienNEstParti = sent === 0 && recipientsCount > 0;

  await prisma.newsletter.update({
    where: { id },
    data: rienNEstParti
      ? { status: 'FAILED', sentAt: null, sentCount: 0 }
      : { status: 'SENT', sentCount: sent },
  });

  /* Le détail par destinataire vit dans EmailLog, pas dans ces lignes :
     recopier les adresses dans les journaux de l'hébergeur reviendrait sur la
     règle posée pour error.middleware.js. */
  if (rienNEstParti) {
    console.error(`[Newsletter ${id}] échec total : ${failed} envoi(s) refusé(s) sur ${recipientsCount} — voir EmailLog`);
  } else if (failed > 0) {
    console.warn(`[Newsletter ${id}] ${failed} destinataire(s) non joint(s) sur ${recipientsCount} — voir EmailLog`);
  }
}

/* La diffusion elle-même. À lancer sans l'attendre.

   Elle ne laisse échapper aucune exception : la réponse HTTP est déjà partie
   quand elle commence, et un rejet non capturé arrêterait le processus Node.
   Le rattrapage repose le statut à FAILED, sans quoi la newsletter resterait
   éternellement « en cours d'envoi » aux yeux de l'écran de communication.

   `trace` porte de quoi journaliser — l'administrateur, son adresse IP — sans
   retenir l'objet requête entier, qui n'a plus lieu d'exister une fois la
   réponse écrite. */
export async function diffuserNewsletter({ id, newsletter, recipients, trace = null }) {
  try {
    const result = await emailService.sendNewsletter(newsletter, recipients, {
      /* Le compte avance en base à chaque lot : c'est ce que l'écran relit pour
         montrer où en est l'envoi, à la place de la roue qui tournait. */
      onProgress: ({ sent }) => prisma.newsletter.update({
        where: { id },
        data: { sentCount: sent },
      }),
    });

    if (!result.success) {
      console.error(`[Newsletter ${id}] envoi interrompu : ${result.error}`);
      await finaliser({ id, sent: 0, failed: recipients.length, recipientsCount: recipients.length });

      return { sent: 0, failed: recipients.length };
    }

    const { sent, failed } = result.results;

    await finaliser({ id, sent, failed, recipientsCount: recipients.length });

    /* Qui a écrit à tout le monde, quand, à quelle liste et combien de boîtes
       ont reçu le message. Newsletter.createdBy ne répond qu'à la première
       question, et encore : il nomme la main qui a rédigé, pas celle qui a
       appuyé sur « envoyer », et il devient nul lorsque le compte de l'auteur
       est purgé. Le journal, lui, conserve l'adresse de l'administrateur telle
       qu'elle était au moment de l'envoi.

       Écrit à la fin plutôt qu'au départ, pour porter le compte réel. */
    if (trace) {
      await logAudit(trace, 'SEND_NEWSLETTER', 'CRITICAL',
        { type: 'NEWSLETTER', id, label: newsletter.subject },
        { target: newsletter.target, recipientsCount: recipients.length, sentCount: sent, failedCount: failed });
    }

    return { sent, failed };
  } catch (error) {
    console.error(`[Newsletter ${id}] diffusion interrompue : ${error.message}`);

    await prisma.newsletter
      .update({ where: { id }, data: { status: 'FAILED', sentAt: null } })
      .catch((releaseError) => console.error(`[Newsletter ${id}] statut non relâché : ${releaseError.message}`));

    return { sent: 0, failed: recipients.length };
  }
}

/* Lancer la diffusion sans l'attendre.

   Le `void` est délibéré, et le .catch aussi : diffuserNewsletter ne rejette
   pas, mais si elle venait à le faire, un rejet non capturé ici arrêterait le
   processus. Une ligne pour deux appelants, plutôt que la même précaution
   recopiée dans chacun. */
export function lancerDiffusion(params) {
  void diffuserNewsletter(params)
    .catch((error) => console.error(`[Newsletter ${params.id}] diffusion non capturée : ${error.message}`));
}
