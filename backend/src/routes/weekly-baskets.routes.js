import express from 'express';
import {
  getAllWeeklyBaskets,
  getWeeklyBasketById,
  getCurrentWeeklyBasket,
  createWeeklyBasket,
  updateWeeklyBasket,
  deleteWeeklyBasket,
  publishWeeklyBasket,
  duplicateWeeklyBasket,
  addProductToBasket,
  updateBasketProduct,
  removeProductFromBasket
} from '../controllers/weekly-baskets.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { adminOnly } from '../middlewares/role.middleware.js';

const router = express.Router();

// Routes publiques
router.get('/current', getCurrentWeeklyBasket); // Panier de la semaine en cours

// Routes authentifiées
router.get('/', authMiddleware, getAllWeeklyBaskets);
router.get('/:id', authMiddleware, getWeeklyBasketById);

// Routes admin uniquement
router.post('/', authMiddleware, adminOnly, createWeeklyBasket);
router.put('/:id', authMiddleware, adminOnly, updateWeeklyBasket);
router.delete('/:id', authMiddleware, adminOnly, deleteWeeklyBasket);
router.post('/:id/publish', authMiddleware, adminOnly, publishWeeklyBasket);
router.post('/:id/duplicate', authMiddleware, adminOnly, duplicateWeeklyBasket);

// Gestion des produits dans le panier
router.post('/:id/products', authMiddleware, adminOnly, addProductToBasket);
router.put('/:id/products/:productId', authMiddleware, adminOnly, updateBasketProduct);
router.delete('/:id/products/:productId', authMiddleware, adminOnly, removeProductFromBasket);

export default router;