/* La diffusion d'une newsletter, hors de la requête qui l'a déclenchée.

   Cinq cents adhérents demandent plus de quatre minutes, pendant lesquelles la
   requête restait ouverte jusqu'à ce que le proxy coupe.

     requête ──> réserver() ──> 202
                     └──> diffuser() ─ lot ─> lot ─┐
                                                   v
                                     statut + compteur en base ──> écran

   Deux appelants passent par ici : l'envoi manuel et l'annonce de fermeture. */

import { prisma } from '../config/database.js';
import emailService from './email.service.js';
import { logAudit } from './audit.service.js';

/* FAILED est un état de départ au même titre que DRAFT : une tentative qui n'a
   atteint personne ne condamne pas le texte. */
const ETATS_DE_DEPART = ['DRAFT', 'FAILED'];

/* Compare-and-set atomique : c'est la base qui arbitre entre deux requêtes
   concurrentes. Même motif que renewalReminder.job.js — un e-mail parti ne se
   reprend pas, on préfère en rater un qu'en doubler un. */
export async function reserverNewsletter(id) {
  const { count } = await prisma.newsletter.updateMany({
    where: { id, status: { in: ETATS_DE_DEPART } },
    data: { status: 'SENDING', sentAt: new Date(), sentCount: 0 },
  });

  return count === 1;
}

/* sentAt garde l'heure du départ : le redater serait faux, l'envoi a commencé
   plusieurs minutes plus tôt. Une liste vide n'est pas un échec — il n'y avait
   personne à qui écrire. */
async function finaliser({ id, sent, failed, recipientsCount }) {
  const rienNEstParti = sent === 0 && recipientsCount > 0;

  await prisma.newsletter.update({
    where: { id },
    data: rienNEstParti
      ? { status: 'FAILED', sentAt: null, sentCount: 0 }
      : { status: 'SENT', sentCount: sent },
  });

  // Le détail par destinataire est dans EmailLog, pas dans ces lignes.
  if (rienNEstParti) {
    console.error(`[Newsletter ${id}] échec total : ${failed} envoi(s) refusé(s) sur ${recipientsCount} — voir EmailLog`);
  } else if (failed > 0) {
    console.warn(`[Newsletter ${id}] ${failed} destinataire(s) non joint(s) sur ${recipientsCount} — voir EmailLog`);
  }
}

/* À lancer sans l'attendre. Ne laisse échapper aucune exception : la réponse
   est déjà partie, un rejet non capturé arrêterait le processus. Le rattrapage
   repose le statut, sans quoi la newsletter resterait « en cours » pour
   toujours. `trace` évite de retenir l'objet requête entier. */
export async function diffuserNewsletter({ id, newsletter, recipients, trace = null }) {
  try {
    const result = await emailService.sendNewsletter(newsletter, recipients, {
      // C'est ce que l'écran relit pour montrer où en est l'envoi.
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

    /* createdBy nomme la main qui a rédigé, pas celle qui a envoyé, et devient
       nul à la purge du compte. Écrit à la fin, pour porter le compte réel. */
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

// Le `void` est délibéré, le .catch est une ceinture : un rejet arrêterait Node.
export function lancerDiffusion(params) {
  void diffuserNewsletter(params)
    .catch((error) => console.error(`[Newsletter ${params.id}] diffusion non capturée : ${error.message}`));
}
