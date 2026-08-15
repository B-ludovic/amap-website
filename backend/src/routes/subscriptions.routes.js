import express from 'express';
import {
  getAllSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  recordChequesReceived,
  updatePayment,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  getMySubscription,
  getPricing,
  getSubscriptionRequests,
  getSubscriptionStats,
  generateContractFromSubscription
} from '../controllers/subscriptions.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { adminOnly } from '../middlewares/role.middleware.js';
import rateLimit from 'express-rate-limit';

/* La correction d'un chèque peut demander le mot de passe de l'administrateur.
   Une invite de mot de passe est un oracle : sans plafond, elle offrirait un
   moyen d'essayer des mots de passe depuis une session déjà ouverte. Même
   fenêtre que la connexion, un peu plus large — un trésorier qui se trompe deux
   fois de suite ne doit pas rester bloqué toute une permanence. */
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Trop de tentatives, réessayez dans 15 minutes.' } },
});

const router = express.Router();

// Route publique — grille tarifaire affichée par le formulaire d'abonnement.
// Déclarée avant '/:id' : Express sert la première route qui correspond, et
// '/:id' capturerait « pricing » comme un identifiant.
router.get('/pricing', getPricing);

// Routes adhérents
router.get('/me', authMiddleware, getMySubscription);
// Contrat PDF : le contrôleur vérifie que l'appelant est admin ou propriétaire
router.get('/:id/contract', authMiddleware, generateContractFromSubscription);

// Routes admin
router.get('/', authMiddleware, adminOnly, getAllSubscriptions);
router.get('/stats', authMiddleware, adminOnly, getSubscriptionStats);
router.get('/requests', authMiddleware, adminOnly, getSubscriptionRequests);
router.get('/:id', authMiddleware, adminOnly, getSubscriptionById);
router.post('/', authMiddleware, adminOnly, createSubscription);
router.put('/:id', authMiddleware, adminOnly, updateSubscription);
router.post('/:id/cheques', authMiddleware, adminOnly, recordChequesReceived);
router.patch('/:id/cheques/:paymentId', paymentLimiter, authMiddleware, adminOnly, updatePayment);
router.put('/:id/cancel', authMiddleware, adminOnly, cancelSubscription);
router.put('/:id/pause', authMiddleware, adminOnly, pauseSubscription);
router.put('/:id/resume', authMiddleware, adminOnly, resumeSubscription);

export default router;