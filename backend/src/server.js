import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { connectDB, disconnectDB } from './config/database.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { httpStatusCodes } from './utils/httpErrors.js';

// Import des routes 
import authRoutes from './routes/auth.routes.js';
import producersRoutes from './routes/producers.routes.js';
import basketsRoutes from './routes/baskets.routes.js';
import ordersRoutes from './routes/orders.routes.js';
import paymentsRoutes from './routes/payments.routes.js';
import adminRoutes from './routes/admin.routes.js';
import shiftsRoutes from './routes/shifts.routes.js';
import newslettersRoutes from './routes/newsletters.routes.js';
import producerInquiriesRoutes from './routes/producer-inquiries.routes.js';
import weeklyBasketsRoutes from './routes/weekly-baskets.routes.js';
import subscriptionsRoutes from './routes/subscriptions.routes.js';
import distributionRoutes from './routes/distribution.routes.js';


// Charge les variables d'environnement
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 4000;

// === MIDDLEWARES ===

// Sécurité avec helmet (protège contre certaines attaques)
app.use(helmet());

// CORS - autorise le frontend à appeler l'API
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true, // Permet d'envoyer les cookies
};
app.use(cors(corsOptions));

// Parse le JSON dans le body des requêtes
app.use(express.json());

// Parse les données de formulaire URL-encoded
app.use(express.urlencoded({ extended: true }));

// ROUTES


// Route de base
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Bienvenue sur l\'API Aux P\'tits Pois 🌱',
    version: '1.0.0'
  });
});

// Route de santé (pour vérifier que le serveur tourne)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime() // Temps depuis le démarrage en secondes
  });
});


// Routes de l'application
app.use('/api/auth', authRoutes);
app.use('/api/producers', producersRoutes);
app.use('/api/baskets', basketsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/admin', adminRoutes);


// Routes supplémentaires
app.use('/api/shifts', shiftsRoutes);
app.use('/api/newsletters', newslettersRoutes);
app.use('/api/producer-inquiries', producerInquiriesRoutes);
app.use('/api/weekly-baskets', weeklyBasketsRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/distribution', distributionRoutes);


// Route 404 - si aucune route ne correspond
app.use((req, res) => {
  res.status(httpStatusCodes.NOT_FOUND).json({
    success: false,
    error: {
      message: 'Route non trouvée',
      path: req.path
    }
  });
});

// Middleware de gestion des erreurs (doit être en dernier)
app.use(errorHandler);

// === DÉMARRAGE DU SERVEUR ===

const startServer = async () => {
  try {
    // On se connecte à la base de données
    await connectDB();
    
    // On démarre le serveur
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

// Quand on fait Ctrl+C dans le terminal
process.on('SIGINT', async () => {
  console.log('\n⏳ Arrêt du serveur en cours...');
  await disconnectDB();
  console.log('👋 Serveur arrêté proprement');
  process.exit(0);
});

// Quand le process est tué (par exemple avec kill)
process.on('SIGTERM', async () => {
  console.log('\n⏳ Arrêt du serveur en cours...');
  await disconnectDB();
  console.log('👋 Serveur arrêté proprement');
  process.exit(0);
});

// Démarrage !
startServer();