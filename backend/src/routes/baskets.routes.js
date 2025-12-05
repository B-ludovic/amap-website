import express from 'express';
import {
  getAllBasketTypes,
  getBasketTypeById,
  getAvailableBaskets,
} from '../controllers/baskets.controller.js';

const router = express.Router();

// Routes publiques - voir les paniers
router.get('/', getAllBasketTypes);
router.get('/:id', getBasketTypeById);

// Voir les paniers disponibles pour une date et un point de retrait
router.get('/available', getAvailableBaskets);

export default router;