import { prisma } from '../config/database.js';
import { logAudit } from '../services/audit.service.js';

/* Exportée : l'accusé de suppression annonce cette date à l'adhérent, et deux
   exemplaires de ce nombre finiraient par diverger. */
export const DELETED_ACCOUNT_RETENTION_DAYS = 90;
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

/* EmailLog porte une adresse par ligne. Un an, la durée pendant laquelle on se
   demande encore si un message est bien arrivé. Ces lignes ne sont pas reliées
   aux comptes — les relier obligerait à lire les adresses avant la transaction,
   ce que ce job refuse par ailleurs — elles vieillissent seules. */
const EMAIL_LOG_RETENTION_DAYS = 365;

/* Une adresse écartée l'est sur la foi d'un rebond, pas d'un consentement : la
   garder indéfiniment reviendrait à tenir un fichier d'adresses sans terme.
   Deux ans sans nouvel événement, et on redonne sa chance à la boîte — si elle
   est toujours morte, le premier message la remettra dans la liste, au prix
   d'un rebond tous les deux ans. */
const EMAIL_SUPPRESSION_RETENTION_DAYS = 2 * 365;

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

  return count;
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

  return count;
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

  return count;
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

  return count;
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

  return count;
}

// Pas de garde-fou « non traité » : une trace n'attend de geste de personne.
async function purgeEmailLogs() {
  const cutoff = daysAgo(EMAIL_LOG_RETENTION_DAYS);

  const { count } = await prisma.emailLog.deleteMany({
    where: { sentAt: { lte: cutoff } },
  });

  if (count > 0) {
    await logAudit(null, 'PURGE_USER_DATA', 'IMPORTANT', { type: 'EMAIL_LOG', label: 'Traces d\'envoi d\'emails' }, { count, retentionDays: EMAIL_LOG_RETENTION_DAYS });
    console.log(`[RetentionJob] ${count} trace(s) d'email purgée(s) (>${EMAIL_LOG_RETENTION_DAYS}j)`);
  }

  return count;
}

/* Les adresses écartées à la main ne vieillissent pas : quelqu'un les a mises
   là en connaissance de cause, ce n'est pas au calendrier de défaire ce geste. */
async function purgeEmailSuppressions() {
  const cutoff = daysAgo(EMAIL_SUPPRESSION_RETENTION_DAYS);

  const { count } = await prisma.emailSuppression.deleteMany({
    where: { reason: { not: 'MANUAL' }, lastEventAt: { lte: cutoff } },
  });

  if (count > 0) {
    await logAudit(null, 'PURGE_USER_DATA', 'IMPORTANT', { type: 'EMAIL_SUPPRESSION', label: 'Adresses écartées des envois' }, { count, retentionDays: EMAIL_SUPPRESSION_RETENTION_DAYS });
    console.log(`[RetentionJob] ${count} adresse(s) écartée(s) remise(s) en circulation (>${EMAIL_SUPPRESSION_RETENTION_DAYS}j)`);
  }

  return count;
}

/* Le passage laisse une trace même quand il n'a rien trouvé à purger, et c'est
   tout l'intérêt de cette ligne : les sept purges ci-dessus ne journalisent que
   sous « count > 0 », si bien qu'un journal muet ne disait pas si le job avait
   tourné à vide ou n'avait pas tourné du tout. Or les deux se ressemblent
   exactement, et l'un des deux est une panne — celle décrite plus bas, où une
   instance endormie ne laisse jamais la minuterie arriver à son terme.

   C'est aussi ce qui permet de démontrer qu'une politique de conservation est
   appliquée, et pas seulement écrite : le registre porte alors la preuve de
   chaque passage, pas uniquement celle des suppressions. */
export async function runRetentionJob() {
  const startedAt = Date.now();

  try {
    // Séquentiel, comme avant : l'ordre des clés est celui des appels.
    const counts = {
      deletedAccounts: await purgeDeletedAccounts(),
      unverifiedAccounts: await purgeUnverifiedAccounts(),
      contactMessages: await purgeContactMessages(),
      producerInquiries: await purgeProducerInquiries(),
      orphanSubscriptionRequests: await purgeOrphanSubscriptionRequests(),
      emailLogs: await purgeEmailLogs(),
      emailSuppressions: await purgeEmailSuppressions(),
    };

    const total = Object.values(counts).reduce((somme, n) => somme + n, 0);
    const durationMs = Date.now() - startedAt;

    await logAudit(
      null,
      'RETENTION_JOB_RUN',
      'IMPORTANT',
      { type: 'JOB', label: 'Passage de rétention' },
      { ...counts, total, durationMs },
    );
    console.log(`[RetentionJob] Passage terminé — ${total} enregistrement(s) purgé(s) en ${durationMs} ms`);
  } catch (error) {
    console.error('[RetentionJob] Erreur lors de la purge des données:', error);

    /* Un passage interrompu laisse la base à moitié purgée, sans que rien ne le
       dise au registre : les purges déjà faites y figurent, celles qui n'ont pas
       eu lieu ne s'y distinguent pas d'un rien à faire. */
    await logAudit(
      null,
      'RETENTION_JOB_FAILED',
      'CRITICAL',
      { type: 'JOB', label: 'Passage de rétention interrompu' },
      { message: error?.message ?? String(error), durationMs: Date.now() - startedAt },
    );
  }
}

const FIRST_RUN_DELAY_MS = 60 * 60 * 1000;
const INTERVAL_MS = 24 * 60 * 60 * 1000;

/* Le premier passage attend une heure au lieu de partir avec le processus.

   Les autres jobs peuvent se permettre de démarrer aussitôt : ils envoient des
   e-mails ou créent des paniers, et une erreur s'y rattrape. Celui-ci détruit,
   sans sauvegarde applicative derrière. Un déploiement relance le processus, donc
   une purge partait dans les secondes suivant la mise en ligne — avant que
   quiconque ait ouvert le site pour vérifier que la version déployée est saine.
   Un filtre devenu trop large aurait effacé avant d'être vu. Cette heure est la
   fenêtre pendant laquelle on peut encore revenir en arrière.

   L'intervalle quotidien part de la fin de ce premier passage plutôt que du
   démarrage, sans quoi les deux premières purges tomberaient à une heure puis à
   vingt-quatre, soit vingt-trois heures d'écart au lieu de vingt-quatre.

   Reste ce que ce code ne peut pas régler seul : deux instances du serveur, ce
   sont deux minuteries, donc deux purges qui se croisent et deux décomptes
   contradictoires dans le journal. Et à l'inverse, sur une instance qui s'endort
   faute de trafic, un réveil de moins d'une heure ne laisse jamais la purge
   partir. Les deux défauts ont la même cause — le calendrier vit dans le
   processus web — et la même réponse : un déclencheur externe, du type Cron Job
   Render, qui appelle la purge une fois par jour quel que soit le nombre
   d'instances. */
export function startDataRetentionJob() {
  setTimeout(() => {
    runRetentionJob();
    setInterval(runRetentionJob, INTERVAL_MS);
  }, FIRST_RUN_DELAY_MS);

  console.log('[RetentionJob] Job de rétention RGPD démarré (premier passage dans 1 h, puis quotidien)');
}
