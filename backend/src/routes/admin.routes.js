import express from 'express';
import {
  createProducer,
  updateProducer,
  deleteProducer,
  getAllProducers,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllProducts,
  getAllOrders,
  updateOrderStatus,
  getStats,
  getAllUsers,
  getUserByEmail,
  changeUserRole,
  deleteUser,
  updateTheme,
  getActiveTheme,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  getExampleStats,
  deleteAllExamples
} from '../controllers/admin.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { adminOnly } from '../middlewares/role.middleware.js';

const router = express.Router();

// Toutes les routes nécessitent d'être admin
router.use(authMiddleware, adminOnly);

// GESTION DES PRODUCTEURS
router.get('/producers', getAllProducers);
router.post('/producers', createProducer);
router.put('/producers/:id', updateProducer);
router.delete('/producers/:id', deleteProducer);

// GESTION DES PRODUITS
router.get('/products', getAllProducts);
router.post('/products', createProduct);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);

// GESTION DES COMMANDES
router.get('/orders', getAllOrders);
router.put('/orders/:id/status', updateOrderStatus);

// GESTION DES UTILISATEURS
router.get('/users', getAllUsers);
router.get('/users/by-email/:email', getUserByEmail);
router.put('/users/:userId/role', changeUserRole);
router.delete('/users/:userId', deleteUser);

// GESTION DES THÈMES SAISONNIERS
router.put('/theme', updateTheme);
router.get('/theme/active', getActiveTheme);

// GESTION DU BLOG
router.post('/blog', createBlogPost);
router.put('/blog/:id', updateBlogPost);
router.delete('/blog/:id', deleteBlogPost);

// STATISTIQUES
router.get('/stats', getStats);

// GESTION DES EXEMPLES DE DONNÉES
router.get('/examples/stats', getExampleStats);
router.delete('/examples', deleteAllExamples);


export default router;