// Charge et contrôle les variables d'environnement EN PREMIER.
// Cet import doit rester en tête : il garantit que process.env est complet
// avant l'évaluation de tous les modules déclarés en dessous.
import './config/env.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { connectDB, disconnectDB } from './config/database.js';
import { closeEmailTransport } from './services/email.service.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { httpStatusCodes } from './utils/httpErrors.js';

// Import des routes
import authRoutes from './routes/auth.routes.js';
import producersRoutes from './routes/producers.routes.js';
import statsRoutes from './routes/stats.routes.js';
import adminRoutes from './routes/admin.routes.js';
import shiftsRoutes from './routes/shifts.routes.js';
import newslettersRoutes from './routes/newsletters.routes.js';
import producerInquiriesRoutes from './routes/producer-inquiries.routes.js';
import weeklyBasketsRoutes from './routes/weekly-baskets.routes.js';
import subscriptionsRoutes from './routes/subscriptions.routes.js';
import subscriptionRequestsRoutes from './routes/subscription-requests.routes.js';
import distributionRoutes from './routes/distribution.routes.js';
import recipesRoutes from './routes/recipes.routes.js';
import contactRoutes from './routes/contact.routes.js';
import closuresRoutes from './routes/closures.routes.js';
import { startRenewalReminderJob } from './jobs/renewalReminder.job.js';
import { startDataRetentionJob } from './jobs/dataRetention.job.js';
import { startWeeklyBasketGenerationJob } from './jobs/weeklyBasketGeneration.job.js';
import { startChequeReminderJob } from './jobs/chequeReminder.job.js';
import { startPauseResumeJob } from './jobs/pauseResume.job.js';
import { startOrphanFlagsJob } from './jobs/orphanFlags.job.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Render transmet l'IP cliente dans X-Forwarded-For derrière son proxy.
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);

// === MIDDLEWARES ===

// Sécurité avec helmet (protège contre certaines attaques)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
}));

// CORS - autorise le frontend à appeler l'API
// Déploiement : frontend sur Vercel (auxptitspois.fr), backend sur Render
// → Ajouter l'URL Vercel de prévisualisation si besoin (ex: https://amap-website-xxx.vercel.app)
// → FRONTEND_URL doit être défini dans les variables d'env Render (ex: https://auxptitspois.fr)
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.FRONTEND_URL,   // à configurer sur Render : https://auxptitspois.fr
  'https://auxptitspois.fr',
  'https://www.auxptitspois.fr',
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Requête sans Origin : appel serveur à serveur (composants serveur Next,
    // health check Render, Postman). Ce n'est pas un navigateur, CORS ne
    // s'applique pas — on laisse passer sans en-tête d'autorisation.
    if (!origin) {
      return callback(null, false);
    }
    // Refuser, ce n'est pas planter : callback(null, false) n'ajoute aucun
    // en-tête CORS, le navigateur bloque donc la lecture de la réponse. Lever
    // une Error ferait répondre 500 à tout le monde, y compris aux clients
    // non-navigateur. La protection CSRF, elle, tient au cookie SameSite=Lax.
    callback(null, ALLOWED_ORIGINS.includes(origin));
  },
  credentials: true,
};
app.use(cors(corsOptions));

// Parse le JSON dans le body des requêtes (limité à 100kb)
// Seul format accepté : aucune route ne consomme de formulaire URL-encoded, et
// c'est le seul corps qu'un formulaire HTML hostile peut envoyer sans préflight.
app.use(express.json({ limit: '100kb' }));

// Parse les cookies
app.use(cookieParser());

// Rate limiting — global (anti-DoS basique sur toute l'API)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Trop de requêtes, réessayez dans 15 minutes.' } },
});
app.use('/api', globalLimiter);

// Rate limiting — authentification (anti brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Trop de tentatives, réessayez dans 15 minutes.' } },
});

// Rate limiting — génération PDF Puppeteer (coûteux)
const pdfLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Trop de requêtes, réessayez dans une minute.' } },
});

// Rate limiting — endpoints publics sensibles (inscription, contact, formulaires)
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Trop de tentatives, réessayez dans 15 minutes.' } },
});

/* Rate limiting — envoi d'une newsletter

   Cette route est déjà réservée aux administrateurs, ce qui suffisait à la
   laisser sous le seul plafond global de 300 requêtes par quart d'heure. Sauf
   que ce plafond autorise trois cents envois de masse en quinze minutes, chacun
   pouvant toucher l'ensemble des adhérents : un compte administrateur compromis
   ne vide pas seulement le quota Brevo, il brûle la réputation d'expéditeur du
   domaine — et l'association ne peut alors plus prévenir personne de la
   distribution du mercredi.

   Cinq par heure, donc, ce qui reste très au-dessus de l'usage réel : une AMAP
   écrit à ses adhérents une fois par semaine, pas cinq fois par heure. La
   programmation d'une newsletter n'est volontairement pas limitée ici, puisque
   aucun job ne lit scheduledFor : poser une date n'envoie rien. */
const newsletterSendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Trop d\'envois de newsletter, réessayez dans une heure.' } },
});

/* Rate limiting — désabonnement

   Route publique par nécessité : le lien d'un email doit s'ouvrir sans session.
   Le sceau de l'URL empêche de désabonner autrui, mais rien n'empêche de
   marteler l'adresse avec des sceaux au hasard, chaque essai coûtant un calcul
   d'empreinte et une requête en base.

   Le plafond est volontairement large : un désabonnement en un clic est posté
   par les serveurs de Gmail, pas par la machine de l'adhérent, et plusieurs
   dizaines d'adhérents peuvent donc arriver derrière la même poignée d'adresses
   IP. Un plafond serré transformerait une vague de désabonnements légitimes en
   erreurs — c'est-à-dire en plaintes pour spam. */
const unsubscribeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Trop de requêtes, réessayez dans 15 minutes.' } },
});

// Rate limiting — recherche utilisateur par email (anti-énumération)
// Rate limiting — routes admin générales
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Trop de requêtes admin, réessayez dans 15 minutes.' } },
});

// === ROUTES ===

// Route de base
app.get('/api', (_req, res) => {
  res.json({
    message: 'Bienvenue sur l\'API Aux P\'tits Pois 🌱',
    version: '1.0.0'
  });
});

// Route de santé
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK' });
});

// Routes de l'application
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/register', publicLimiter);
app.use('/api/auth/resend-confirmation', publicLimiter);
app.use('/api/auth/reset-password', publicLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/producers', producersRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminLimiter);
app.use('/api/admin', adminRoutes);

// Routes supplémentaires
app.use('/api/shifts', shiftsRoutes);
// Avant le routeur, comme pdfLimiter : monté après, il ne verrait jamais passer
// la requête.
app.use('/api/newsletters/:id/send', newsletterSendLimiter);
app.use('/api/newsletters/unsubscribe', unsubscribeLimiter);
app.use('/api/newsletters/resubscribe', unsubscribeLimiter);
app.use('/api/newsletters', newslettersRoutes);
app.use('/api/producer-inquiries', publicLimiter);
app.use('/api/producer-inquiries', producerInquiriesRoutes);
app.use('/api/weekly-baskets', weeklyBasketsRoutes);
app.use('/api/subscriptions/:id/contract', pdfLimiter);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/subscription-requests/:id/contract', pdfLimiter);
app.use('/api/subscription-requests', subscriptionRequestsRoutes);
app.use('/api/distribution', distributionRoutes);
app.use('/api/recipes', recipesRoutes);
app.use('/api/contact', publicLimiter);
app.use('/api/contact', contactRoutes);
app.use('/api/closures', closuresRoutes);

// Route 404 - si aucune route ne correspond
app.use((_req, res) => {
  res.status(httpStatusCodes.NOT_FOUND).json({
    success: false,
    error: { message: 'Route non trouvée' }
  });
});

// Middleware de gestion des erreurs (doit être en dernier)
app.use(errorHandler);

// === DÉMARRAGE DU SERVEUR ===

const startServer = async () => {
  try {
    await connectDB();
    startRenewalReminderJob();
    startDataRetentionJob();
    startWeeklyBasketGenerationJob();
    startChequeReminderJob();
    startPauseResumeJob();
    startOrphanFlagsJob();

    app.listen(PORT, () => {
      console.log(`✅ Serveur backend démarré sur http://localhost:${PORT}`);
      console.log(`📚 Documentation API: http://localhost:${PORT}/api`);
      console.log(`💚 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Erreur au démarrage du serveur:', error);
    process.exit(1);
  }
};

// GESTION DE L'ARRÊT PROPRE DU SERVEUR

process.on('SIGINT', async () => {
  console.log('\n⏳ Arrêt du serveur en cours...');
  closeEmailTransport();
  await disconnectDB();
  console.log('👋 Serveur arrêté proprement');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⏳ Arrêt du serveur en cours...');
  closeEmailTransport();
  await disconnectDB();
  console.log('👋 Serveur arrêté proprement');
  process.exit(0);
});

startServer();
