/* Le retour d'expérience des envois : ce que Brevo rapporte, et l'écran qui le
   donne à lire.

   Deux publics dans ce fichier, séparés par le mur d'authentification monté dans
   routes/emails.routes.js. En haut le webhook, ouvert sur l'extérieur et gardé
   par un secret partagé, parce que Brevo ne sait pas ouvrir de session. En bas
   la consultation, réservée aux administrateurs. */

import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { HttpBadRequestError, HttpNotFoundError, HttpUnauthorizedError } from '../utils/httpErrors.js';
import { traiterEvenementBrevo } from '../services/brevoEvents.service.js';
import { retablirAdresse } from '../services/emailSuppression.service.js';
import { logAudit } from '../services/audit.service.js';

/* Brevo ne signe pas ses appels : il n'y a ni HMAC ni certificat client à
   vérifier, seulement l'URL qu'on lui a donnée. Le secret y tient donc lieu de
   preuve d'identité — dans un en-tête si la console Brevo permet d'en poser un,
   sinon dans la chaîne de requête.

   Comparaison à temps constant, comme pour le sceau de désabonnement : un ===
   s'arrête au premier caractère qui diffère et livre le secret octet par octet
   à qui mesure les temps de réponse. */
function secretValide(req) {
  const attendu = process.env.BREVO_WEBHOOK_SECRET;
  if (!attendu) return false;

  const recu = String(req.get?.('x-webhook-secret') ?? req.headers?.['x-webhook-secret'] ?? req.query?.s ?? '');

  const a = Buffer.from(attendu, 'utf8');
  const b = Buffer.from(recu, 'utf8');

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* Le webhook.

   Répondre 200 quoi qu'il arrive une fois le secret vérifié : un 500 fait
   réessayer Brevo, et une série d'échecs lui fait couper l'abonnement — on
   perdrait le signal au moment précis où il devient intéressant. Un événement
   inconnu, une charge mal formée, une base indisponible : tout finit en 200 et
   une ligne de journal.

   Brevo poste un événement par requête. Le tableau est accepté par prudence,
   au cas où un lot arriverait. */
const receiveBrevoEvent = asyncHandler(async (req, res) => {
  if (!secretValide(req)) {
    console.warn('[Webhook Brevo] appel refusé : secret absent ou invalide');
    throw new HttpUnauthorizedError('Accès refusé.');
  }

  const charges = Array.isArray(req.body) ? req.body : [req.body];

  for (const charge of charges) {
    try {
      const resultat = await traiterEvenementBrevo(charge);

      if (resultat.traite && resultat.effets.length > 0) {
        console.log(`[Webhook Brevo] ${resultat.evenement} : ${resultat.effets.join(', ')}`);
      }
    } catch (error) {
      console.error(`[Webhook Brevo] événement non traité : ${error.message}`);
    }
  }

  res.json({ success: true });
});

// LECTURE ADMINISTRATEUR //

const DELIVERIES = ['DELIVERED', 'DEFERRED', 'SOFT_BOUNCE', 'HARD_BOUNCE', 'BLOCKED', 'SPAM_COMPLAINT'];
const STATUSES = ['SENT', 'FAILED'];

/* Les envois, du plus récent au plus ancien.

   Le filtre `probleme` rassemble en un clic ce qu'on vient chercher ici neuf
   fois sur dix : les messages qui ne sont pas arrivés, qu'ils aient été refusés
   par le relais (FAILED) ou rejetés après coup (rebond, blocage, plainte). */
const getEmailLogs = asyncHandler(async (req, res) => {
  const { status, delivery, kind, email, probleme, page = 1, limit = 50 } = req.query;

  if (status && !STATUSES.includes(status)) throw new HttpBadRequestError('Statut invalide');
  if (delivery && !DELIVERIES.includes(delivery)) throw new HttpBadRequestError('Sort de livraison invalide');

  const parsedPage = Math.max(parseInt(page) || 1, 1);
  const parsedLimit = Math.min(parseInt(limit) || 50, 200);

  const where = {
    ...(status && { status }),
    ...(delivery && { delivery }),
    ...(kind && { kind }),
    ...(email && { to: { contains: String(email).trim(), mode: 'insensitive' } }),
    ...(probleme === 'true' && {
      OR: [
        { status: 'FAILED' },
        { delivery: { in: ['SOFT_BOUNCE', 'HARD_BOUNCE', 'BLOCKED', 'SPAM_COMPLAINT'] } },
      ],
    }),
  };

  const [logs, total] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      skip: (parsedPage - 1) * parsedLimit,
      take: parsedLimit,
      orderBy: { sentAt: 'desc' },
    }),
    prisma.emailLog.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      logs,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
      },
    },
  });
});

/* Le résumé des trente derniers jours, en tête d'écran.

   Trente jours plutôt que tout l'historique : un taux de rebond calculé sur un
   an noierait la semaine où quelque chose se casse, et c'est cette semaine-là
   qu'il faut voir. */
const getEmailSummary = asyncHandler(async (_req, res) => {
  const depuis = new Date();
  depuis.setDate(depuis.getDate() - 30);

  const fenetre = { sentAt: { gte: depuis } };

  const [envoyes, refuses, rebonds, plaintes, sansRetour, supprimees] = await Promise.all([
    prisma.emailLog.count({ where: { ...fenetre, status: 'SENT' } }),
    prisma.emailLog.count({ where: { ...fenetre, status: 'FAILED' } }),
    prisma.emailLog.count({ where: { ...fenetre, delivery: { in: ['SOFT_BOUNCE', 'HARD_BOUNCE', 'BLOCKED'] } } }),
    prisma.emailLog.count({ where: { ...fenetre, delivery: 'SPAM_COMPLAINT' } }),
    /* Partis sans qu'aucun événement ne soit jamais revenu. Sur un envoi de la
       veille c'est normal ; sur tout le mois, c'est le signe que le webhook
       n'est pas branché — le seul moyen de distinguer « rien à signaler » de
       « personne ne raconte rien ». */
    prisma.emailLog.count({ where: { ...fenetre, status: 'SENT', delivery: null } }),
    prisma.emailSuppression.count(),
  ]);

  res.json({
    success: true,
    data: { envoyes, refuses, rebonds, plaintes, sansRetour, supprimees, fenetreJours: 30 },
  });
});

const getSuppressions = asyncHandler(async (_req, res) => {
  const suppressions = await prisma.emailSuppression.findMany({
    orderBy: { lastEventAt: 'desc' },
    take: 200,
  });

  res.json({ success: true, data: { suppressions } });
});

/* Remettre une adresse en circulation. Le geste est journalisé : réactiver à
   répétition une adresse qui rebondit abîme la réputation du domaine, et il
   faut pouvoir dire qui l'a fait. */
const deleteSuppression = asyncHandler(async (req, res) => {
  const supprimee = await prisma.emailSuppression.findUnique({ where: { id: req.params.id } });

  if (!supprimee) {
    throw new HttpNotFoundError('Cette adresse n\'est plus dans la liste.');
  }

  await retablirAdresse(supprimee.id);

  await logAudit(
    req,
    'LIFT_EMAIL_SUPPRESSION',
    'IMPORTANT',
    { type: 'EMAIL_SUPPRESSION', id: supprimee.id, label: supprimee.email },
    { reason: supprimee.reason }
  );

  res.json({
    success: true,
    message: 'Les envois vers cette adresse reprennent.',
  });
});

export {
  receiveBrevoEvent,
  getEmailLogs,
  getEmailSummary,
  getSuppressions,
  deleteSuppression,
};
