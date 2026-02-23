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
      const result = await emailService.sendRenewalReminderEmail(sub, sub.user);
      if (result.success) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { renewalReminderSentAt: new Date() },
        });
        sent++;
      } else {
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
