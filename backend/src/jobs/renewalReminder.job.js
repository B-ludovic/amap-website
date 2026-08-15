import { prisma } from '../config/database.js';
import emailService from '../services/email.service.js';

const REMINDER_DAYS = 30;

async function checkRenewalReminders() {
  try {
    const now = new Date();
    const reminderCutoff = new Date();
    reminderCutoff.setDate(reminderCutoff.getDate() + REMINDER_DAYS);

    // Abonnements actifs expirant dans 30 jours dont le rappel n'a pas encore été envoyé
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { gte: now, lte: reminderCutoff },
        renewalReminderSentAt: null,
      },
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
      },
    });

    if (subscriptions.length === 0) {
      console.log('[RenewalJob] Aucun rappel de renouvellement à envoyer');
      return;
    }

    console.log(`[RenewalJob] Envoi de ${subscriptions.length} rappel(s) de renouvellement...`);

    let sent = 0;
    for (const sub of subscriptions) {
      /* On pose le drapeau AVANT d'envoyer. Le updateMany filtré sur
         renewalReminderSentAt: null est un compare-and-set atomique : c'est la
         base qui arbitre, donc deux instances du job ne peuvent pas envoyer le
         même rappel. Un e-mail parti ne se reprend pas — on préfère en rater un
         (échec juste après la prise) plutôt qu'en doubler un. */
      const claimed = await prisma.subscription.updateMany({
        where: { id: sub.id, renewalReminderSentAt: null },
        data: { renewalReminderSentAt: new Date() },
      });
      if (claimed.count === 0) continue;

      const result = await emailService.sendRenewalReminderEmail(sub, sub.user);
      if (result.success) {
        sent++;
      } else {
        // Échec d'envoi : on relâche le drapeau pour retenter au prochain passage.
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { renewalReminderSentAt: null },
        });
        console.error(`[RenewalJob] Échec rappel ${sub.subscriptionNumber}:`, result.error);
      }
    }

    console.log(`[RenewalJob] ${sent}/${subscriptions.length} rappels envoyés`);
  } catch (error) {
    console.error('[RenewalJob] Erreur lors de la vérification des renouvellements:', error);
  }
}

export function startRenewalReminderJob() {
  // Vérification immédiate au démarrage
  checkRenewalReminders();

  // Puis toutes les 24h
  setInterval(checkRenewalReminders, 24 * 60 * 60 * 1000);

  console.log('[RenewalJob] Job de rappel de renouvellement démarré (vérification quotidienne)');
}
