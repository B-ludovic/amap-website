import { prisma } from '../config/database.js';
import { logAudit } from '../services/audit.service.js';

const DELETED_ACCOUNT_RETENTION_DAYS = 90;
const UNVERIFIED_ACCOUNT_RETENTION_DAYS = 30;

/* Les deux formulaires publics déposent des données personnelles sans qu'un
   compte existe derrière : un message de contact porte un nom et une adresse
   e-mail, une candidature producteur porte l'identité complète, le téléphone et
   l'adresse d'une exploitation. Le job ne connaissait que les comptes, ces deux
   tables grossissaient donc sans fin, ce que le principe de limitation de la
   conservation interdit.

   Les durées se comptent depuis la collecte, comme les annoncent les mentions
   légales : un an pour un message de contact, deux ans pour une candidature —
   le temps qu'une association mette à recontacter un producteur d'une saison sur
   l'autre. Elles vivent ici et sont énoncées là-bas ; les changer d'un côté
   oblige à les changer de l'autre. */
const CONTACT_MESSAGE_RETENTION_DAYS = 365;
const PRODUCER_INQUIRY_RETENTION_DAYS = 2 * 365;

/* Une demande d'abonnement porte sa propre identité — nom, e-mail, téléphone —
   et son rattachement à un compte est facultatif. Tant qu'il est renseigné, la
   demande part avec le compte ; sans lui, aucune suppression de compte ne peut
   l'atteindre, et elle resterait en base indéfiniment. Ces orphelines ont donc
   leur propre échéance, comptée depuis leur traitement. */
const ORPHAN_REQUEST_RETENTION_DAYS = 365;

const daysAgo = (days) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return cutoff;
};

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
  const cutoff = daysAgo(DELETED_ACCOUNT_RETENTION_DAYS);

  const count = await purgeUsersMatching({ deletedAt: { not: null, lte: cutoff } });
  if (count > 0) {
    await logAudit(null, 'PURGE_USER_DATA', 'CRITICAL', { type: 'USER', label: 'Comptes supprimés depuis plus de 90 jours' }, { count, retentionDays: DELETED_ACCOUNT_RETENTION_DAYS });
    console.log(`[RetentionJob] ${count} compte(s) supprimé(s) définitivement (>90j)`);
  }
}

async function purgeUnverifiedAccounts() {
  const cutoff = daysAgo(UNVERIFIED_ACCOUNT_RETENTION_DAYS);

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

/* On ne purge que ce qui a été traité. Un message jamais ouvert ou une
   candidature laissée en attente depuis des années sont des oublis de
   l'association, pas des données arrivées au bout de leur vie : les effacer en
   silence ferait disparaître la preuve de l'oubli en même temps que l'oubli.
   Ils sont donc comptés et signalés dans les logs, pour qu'un humain tranche. */
async function warnAboutUntreated(label, count, days) {
  if (count > 0) {
    console.warn(
      `[RetentionJob] ${count} ${label} de plus de ${days} jours en attente de traitement : ` +
      'hors purge tant que leur sort n\'est pas décidé'
    );
  }
}

async function purgeContactMessages() {
  const cutoff = daysAgo(CONTACT_MESSAGE_RETENTION_DAYS);

  const { count } = await prisma.contactMessage.deleteMany({
    where: { status: { in: ['READ', 'ARCHIVED'] }, createdAt: { lte: cutoff } },
  });

  if (count > 0) {
    await logAudit(null, 'PURGE_USER_DATA', 'IMPORTANT', { type: 'CONTACT_MESSAGE', label: 'Messages de contact traités' }, { count, retentionDays: CONTACT_MESSAGE_RETENTION_DAYS });
    console.log(`[RetentionJob] ${count} message(s) de contact purgé(s) (>${CONTACT_MESSAGE_RETENTION_DAYS}j)`);
  }

  const untreated = await prisma.contactMessage.count({
    where: { status: 'UNREAD', createdAt: { lte: cutoff } },
  });
  await warnAboutUntreated('message(s) de contact non lu(s)', untreated, CONTACT_MESSAGE_RETENTION_DAYS);
}

async function purgeProducerInquiries() {
  const cutoff = daysAgo(PRODUCER_INQUIRY_RETENTION_DAYS);

  /* Le point de départ est la date de réponse, sauf qu'archiver une candidature
     remet respondedAt à null (producer-inquiries.controller.js) : filtrer sur ce
     seul champ laisserait les candidatures archivées en base pour toujours,
     c'est-à-dire précisément celles dont on a fini de s'occuper. On retombe
     alors sur updatedAt, qui porte la date du dernier geste administratif. */
  const { count } = await prisma.producerInquiry.deleteMany({
    where: {
      status: { in: ['REJECTED', 'ARCHIVED'] },
      OR: [
        { respondedAt: { lte: cutoff } },
        { respondedAt: null, updatedAt: { lte: cutoff } },
      ],
    },
  });

  if (count > 0) {
    await logAudit(null, 'PURGE_USER_DATA', 'IMPORTANT', { type: 'PRODUCER_INQUIRY', label: 'Candidatures producteurs traitées' }, { count, retentionDays: PRODUCER_INQUIRY_RETENTION_DAYS });
    console.log(`[RetentionJob] ${count} candidature(s) producteur purgée(s) (>${PRODUCER_INQUIRY_RETENTION_DAYS}j)`);
  }

  const untreated = await prisma.producerInquiry.count({
    where: { status: { in: ['PENDING', 'IN_PROGRESS'] }, createdAt: { lte: cutoff } },
  });
  await warnAboutUntreated('candidature(s) producteur sans réponse', untreated, PRODUCER_INQUIRY_RETENTION_DAYS);
}

/* Les demandes rattachées à un compte ne sont pas concernées : elles suivent le
   compte, et tant qu'il vit la demande documente la relation en cours. Seules
   les orphelines vieillissent pour leur propre compte.

   Le rapprochement par e-mail avec les comptes en cours de purge a été écarté,
   bien qu'il paraisse plus direct. Il obligerait à lire la liste des adresses
   concernées avant d'ouvrir la transaction, alors que tout ce job est bâti sur
   l'inverse — un filtre relationnel réévalué au moment de la suppression, pour
   qu'un compte restauré entre-temps échappe à la purge au lieu d'être emporté.
   Une adresse lue trop tôt rouvrirait exactement cette fenêtre. Et ce
   rapprochement ne verrait de toute façon que les orphelines dont l'adresse
   correspond à un compte : celles déposées sans compte, qui sont la raison
   d'être de cette purge, lui resteraient invisibles. */
async function purgeOrphanSubscriptionRequests() {
  const cutoff = daysAgo(ORPHAN_REQUEST_RETENTION_DAYS);

  /* Même précaution que pour les candidatures producteurs : ramener une demande
     en arrière ou l'archiver efface son tampon de traitement
     (subscription-requests.controller.js), d'où le repli sur updatedAt. */
  const { count } = await prisma.subscriptionRequest.deleteMany({
    where: {
      userId: null,
      status: { in: ['APPROVED', 'REJECTED', 'ARCHIVED'] },
      OR: [
        { processedAt: { lte: cutoff } },
        { processedAt: null, updatedAt: { lte: cutoff } },
      ],
    },
  });

  if (count > 0) {
    await logAudit(null, 'PURGE_USER_DATA', 'IMPORTANT', { type: 'SUBSCRIPTION_REQUEST', label: 'Demandes d\'abonnement sans compte' }, { count, retentionDays: ORPHAN_REQUEST_RETENTION_DAYS });
    console.log(`[RetentionJob] ${count} demande(s) d'abonnement orpheline(s) purgée(s) (>${ORPHAN_REQUEST_RETENTION_DAYS}j)`);
  }

  const untreated = await prisma.subscriptionRequest.count({
    where: { userId: null, status: { in: ['PENDING', 'IN_PROGRESS'] }, createdAt: { lte: cutoff } },
  });
  await warnAboutUntreated('demande(s) d\'abonnement sans compte non traitée(s)', untreated, ORPHAN_REQUEST_RETENTION_DAYS);
}

async function runRetentionJob() {
  try {
    await purgeDeletedAccounts();
    await purgeUnverifiedAccounts();
    await purgeContactMessages();
    await purgeProducerInquiries();
    await purgeOrphanSubscriptionRequests();
  } catch (error) {
    console.error('[RetentionJob] Erreur lors de la purge des données:', error);
  }
}

export function startDataRetentionJob() {
  runRetentionJob();
  setInterval(runRetentionJob, 24 * 60 * 60 * 1000);
  console.log('[RetentionJob] Job de rétention RGPD démarré (purge quotidienne)');
}
