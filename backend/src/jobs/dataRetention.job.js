import { prisma } from '../config/database.js';

const DELETED_ACCOUNT_RETENTION_DAYS = 90;
const UNVERIFIED_ACCOUNT_RETENTION_DAYS = 30;

// Supprime les données liées puis les utilisateurs (pas de cascade dans le schéma)
async function purgeUsers(userIds) {
  if (userIds.length === 0) return 0;

  await prisma.$transaction([
    // Données liées aux abonnements
    prisma.weeklyPickup.deleteMany({ where: { subscription: { userId: { in: userIds } } } }),
    prisma.subscriptionPause.deleteMany({ where: { subscription: { userId: { in: userIds } } } }),
    prisma.payment.deleteMany({ where: { subscription: { userId: { in: userIds } } } }),
    prisma.subscription.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.subscriptionRequest.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.newsletter.deleteMany({ where: { createdBy: { in: userIds } } }),
    prisma.recipe.deleteMany({ where: { authorId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);

  return userIds.length;
}

async function purgeDeletedAccounts() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DELETED_ACCOUNT_RETENTION_DAYS);

  const users = await prisma.user.findMany({
    where: { deletedAt: { not: null, lte: cutoff } },
    select: { id: true },
  });

  const count = await purgeUsers(users.map(u => u.id));
  if (count > 0) {
    console.log(`[RetentionJob] ${count} compte(s) supprimé(s) définitivement (>90j)`);
  }
}

async function purgeUnverifiedAccounts() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - UNVERIFIED_ACCOUNT_RETENTION_DAYS);

  const users = await prisma.user.findMany({
    where: { emailVerified: false, deletedAt: null, createdAt: { lte: cutoff } },
    select: { id: true },
  });

  const count = await purgeUsers(users.map(u => u.id));
  if (count > 0) {
    console.log(`[RetentionJob] ${count} inscription(s) non vérifiée(s) supprimée(s) (>30j)`);
  }
}

async function runRetentionJob() {
  try {
    await purgeDeletedAccounts();
    await purgeUnverifiedAccounts();
  } catch (error) {
    console.error('[RetentionJob] Erreur lors de la purge des données:', error);
  }
}

export function startDataRetentionJob() {
  runRetentionJob();
  setInterval(runRetentionJob, 24 * 60 * 60 * 1000);
  console.log('[RetentionJob] Job de rétention RGPD démarré (purge quotidienne)');
}
