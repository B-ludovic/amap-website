import express from 'express';
import {
  getAllSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  activateSubscription,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  getMySubscription,
  getSubscriptionRequests,
  getSubscriptionStats,
  generateContractFromSubscription
} from '../controllers/subscriptions.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { adminOnly } from '../middlewares/role.middleware.js';

const router = express.Router();

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
router.put('/:id/activate', authMiddleware, adminOnly, activateSubscription);
router.put('/:id/cancel', authMiddleware, adminOnly, cancelSubscription);
router.put('/:id/pause', authMiddleware, adminOnly, pauseSubscription);
router.put('/:id/resume', authMiddleware, adminOnly, resumeSubscription);

export default router;