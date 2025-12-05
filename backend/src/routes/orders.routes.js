import express from 'express';
import {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
} from '../controllers/orders.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Toutes ces routes nécessitent d'être connecté
router.use(authMiddleware);

// Créer une commande
router.post('/', createOrder);

// Voir mes commandes
router.get('/my-orders', getMyOrders);

// Voir une commande spécifique
router.get('/:id', getOrderById);

// Annuler une commande
router.delete('/:id/cancel', cancelOrder);

export default router;