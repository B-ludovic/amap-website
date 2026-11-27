import express from 'express';
import { submitAccessRequest } from '../controllers/producer-access-requests.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Demande d'accès à l'espace producteur, déposée par un compte connecté
router.post('/', authMiddleware, submitAccessRequest);

export default router;
