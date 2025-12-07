import express from 'express';
import {
  getAllSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  getMySubscription,
  submitSubscriptionRequest,
  getSubscriptionRequests,
  getSubscriptionStats
} from '../controllers/subscriptions.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { adminOnly } from '../middlewares/role.middleware.js';

const router = express.Router();

// Route publique - Demande d'abonnement (formulaire)
router.post('/request', submitSubscriptionRequest);

// Routes adhérents
router.get('/me', authMiddleware, getMySubscription);

// Routes admin
router.get('/', authMiddleware, adminOnly, getAllSubscriptions);
router.get('/stats', authMiddleware, adminOnly, getSubscriptionStats);
router.get('/requests', authMiddleware, adminOnly, getSubscriptionRequests);
router.get('/:id', authMiddleware, adminOnly, getSubscriptionById);
router.post('/', authMiddleware, adminOnly, createSubscription);
router.put('/:id', authMiddleware, adminOnly, updateSubscription);
router.put('/:id/cancel', authMiddleware, adminOnly, cancelSubscription);
router.put('/:id/pause', authMiddleware, adminOnly, pauseSubscription);
router.put('/:id/resume', authMiddleware, adminOnly, resumeSubscription);

export default router;