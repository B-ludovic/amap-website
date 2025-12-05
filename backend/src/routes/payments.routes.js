import express from 'express';
import {
    createPaymentIntent,
    confirmPayment,
    handleWebhook,
} from '../controllers/payments.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Creer un Payment Intent Stripe
router.post('/create-intent', authMiddleware, createPaymentIntent);

// Confirmer le paiement apres la validation cote client
router.post('/confirm', authMiddleware, confirmPayment);

// Webhook Stripe pour ecouter les evenements de paiement
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

export default router;