import express from 'express';
import {
  submitAccessRequest,
  getMyAccessRequest,
  getAllAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
  revokeAccessRequest,
} from '../controllers/producer-access-requests.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { adminOnly } from '../middlewares/role.middleware.js';

const router = express.Router();

// Demande d'accès à l'espace producteur, déposée par un compte connecté
router.post('/', authMiddleware, submitAccessRequest);
router.get('/me', authMiddleware, getMyAccessRequest);

// Routes admin
router.get('/', authMiddleware, adminOnly, getAllAccessRequests);
router.post('/:id/approve', authMiddleware, adminOnly, approveAccessRequest);
router.post('/:id/reject', authMiddleware, adminOnly, rejectAccessRequest);
router.post('/:id/revoke', authMiddleware, adminOnly, revokeAccessRequest);

export default router;
