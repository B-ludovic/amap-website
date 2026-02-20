// Charge les variables d'environnement EN PREMIER
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectDB, disconnectDB } from './config/database.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { httpStatusCodes } from './utils/httpErrors.js';

// Import des routes
import authRoutes from './routes/auth.routes.js';
import producersRoutes from './routes/producers.routes.js';
import adminRoutes from './routes/admin.routes.js';
import shiftsRoutes from './routes/shifts.routes.js';
import newslettersRoutes from './routes/newsletters.routes.js';
import producerInquiriesRoutes from './routes/producer-inquiries.routes.js';
import weeklyBasketsRoutes from './routes/weekly-baskets.routes.js';
import subscriptionsRoutes from './routes/subscriptions.routes.js';
import subscriptionRequestsRoutes from './routes/subscription-requests.routes.js';
import distributionRoutes from './routes/distribution.routes.js';
import themeRoutes from './routes/theme.routes.js';
import recipesRoutes from './routes/recipes.routes.js';

const app = express();
const PORT = process.env.PORT || 4000;

// === MIDDLEWARES ===

// Sécurité avec helmet (protège contre certaines attaques)
app.use(helmet());

// CORS - autorise le frontend à appeler l'API
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
};
app.use(cors(corsOptions));

// Parse le JSON dans le body des requêtes (limité à 100kb)
app.use(express.json({ limit: '100kb' }));

// Parse les données de formulaire URL-encoded
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

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
app.use('/api/theme', themeRoutes);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/producers', producersRoutes);
app.use('/api/admin', adminRoutes);

// Routes supplémentaires
app.use('/api/shifts', shiftsRoutes);
app.use('/api/newsletters', newslettersRoutes);
app.use('/api/producer-inquiries', producerInquiriesRoutes);
app.use('/api/weekly-baskets', weeklyBasketsRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/subscription-requests/:id/contract', pdfLimiter);
app.use('/api/subscription-requests', subscriptionRequestsRoutes);
app.use('/api/distribution', distributionRoutes);
app.use('/api/recipes', recipesRoutes);

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
  await disconnectDB();
  console.log('👋 Serveur arrêté proprement');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⏳ Arrêt du serveur en cours...');
  await disconnectDB();
  console.log('👋 Serveur arrêté proprement');
  process.exit(0);
});

startServer();
