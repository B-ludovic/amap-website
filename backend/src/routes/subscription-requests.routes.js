import express from 'express';
import {
  submitRequest,
  getAllRequests,
  getRequestById,
  updateRequestStatus
} from '../controllers/subscription-requests.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { adminOnly } from '../middlewares/role.middleware.js';

const router = express.Router();

// Route protégée - formulaire de demande d'abonnement (nécessite d'être connecté)
router.post('/', authMiddleware, submitRequest);

// Routes admin
router.get('/', authMiddleware, adminOnly, getAllRequests);
router.get('/:id', authMiddleware, adminOnly, getRequestById);
router.put('/:id/status', authMiddleware, adminOnly, updateRequestStatus);

export default router;
