import { prisma } from '../config/database.js';

const DELETED_ACCOUNT_RETENTION_DAYS = 90;
const UNVERIFIED_ACCOUNT_RETENTION_DAYS = 30;

async function purgeDeletedAccounts() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DELETED_ACCOUNT_RETENTION_DAYS);

  const result = await prisma.user.deleteMany({
    where: {
      deletedAt: { not: null, lte: cutoff },
    },
  });

  if (result.count > 0) {
    console.log(`[RetentionJob] ${result.count} compte(s) supprimé(s) définitivement (>90j)`);
  }
}

async function purgeUnverifiedAccounts() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - UNVERIFIED_ACCOUNT_RETENTION_DAYS);

  const result = await prisma.user.deleteMany({
    where: {
      emailVerified: false,
      deletedAt: null,
      createdAt: { lte: cutoff },
    },
  });

  if (result.count > 0) {
    console.log(`[RetentionJob] ${result.count} inscription(s) non vérifiée(s) supprimée(s) (>30j)`);
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
