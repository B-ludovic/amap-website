import { prisma } from '../config/database.js';
import { logAudit } from '../services/audit.service.js';

const DELETED_ACCOUNT_RETENTION_DAYS = 90;
const UNVERIFIED_ACCOUNT_RETENTION_DAYS = 30;

/* Supprime les données liées puis les utilisateurs : User ne cascade pas vers
   Subscription ni SubscriptionRequest, qu'il faut donc retirer soi-même.

   Le filtre est relationnel plutôt qu'une liste d'ids lue au préalable : chaque
   instruction réévalue le prédicat au moment où elle s'exécute, donc un compte
   restauré (deletedAt remis à null) entre la lecture et la suppression échappe
   à la purge au lieu d'être emporté avec toutes ses données. */
async function purgeUsersMatching(userWhere) {
  const results = await prisma.$transaction([
    // Données liées aux abonnements
    prisma.weeklyPickup.deleteMany({ where: { subscription: { user: userWhere } } }),
    prisma.subscriptionPause.deleteMany({ where: { subscription: { user: userWhere } } }),
    prisma.payment.deleteMany({ where: { subscription: { user: userWhere } } }),
    prisma.subscription.deleteMany({ where: { user: userWhere } }),
    prisma.subscriptionRequest.deleteMany({ where: { user: userWhere } }),

    /* Le contenu associatif survit à son auteur. Une recette et une newsletter
       ne sont pas les données personnelles d'un adhérent : ce sont les pages
       publiques et les archives de communication de l'association, que le
       bénévole a signées sans en devenir propriétaire. On coupe donc le lien
       nominatif — c'est ce que le RGPD demande — au lieu de détruire le contenu,
       lequel emportait au passage les RecipeProduct en cascade et n'existe dans
       aucune sauvegarde.

       La contrainte de clé étrangère fait déjà ce travail (ON DELETE SET NULL),
       et ces deux lignes seraient donc redondantes si la purge était le seul
       chemin de suppression d'un compte. Elles restent parce qu'elles disent
       l'intention à l'endroit où on la lit : ce job est celui qui détruit, il
       doit énoncer ce qu'il choisit de ne pas détruire. */
    prisma.newsletter.updateMany({ where: { author: userWhere }, data: { createdBy: null } }),
    prisma.recipe.updateMany({ where: { author: userWhere }, data: { authorId: null } }),

    prisma.user.deleteMany({ where: userWhere }),
  ]);

  return results[results.length - 1].count;
}

async function purgeDeletedAccounts() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DELETED_ACCOUNT_RETENTION_DAYS);

  const count = await purgeUsersMatching({ deletedAt: { not: null, lte: cutoff } });
  if (count > 0) {
    await logAudit(null, 'PURGE_USER_DATA', 'CRITICAL', { type: 'USER', label: 'Comptes supprimés depuis plus de 90 jours' }, { count, retentionDays: DELETED_ACCOUNT_RETENTION_DAYS });
    console.log(`[RetentionJob] ${count} compte(s) supprimé(s) définitivement (>90j)`);
  }
}

async function purgeUnverifiedAccounts() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - UNVERIFIED_ACCOUNT_RETENTION_DAYS);

  const count = await purgeUsersMatching({
    emailVerified: false,
    deletedAt: null,
    createdAt: { lte: cutoff },
    role: 'MEMBER',
    subscriptions: { none: {} },
    subscriptionRequests: { none: {} },
  });
  if (count > 0) {
    await logAudit(null, 'PURGE_USER_DATA', 'IMPORTANT', { type: 'USER', label: 'Comptes non vérifiés' }, { count, retentionDays: UNVERIFIED_ACCOUNT_RETENTION_DAYS });
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
