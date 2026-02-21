import express from 'express';
import {
  register,
  login,
  logout,
  getMe,
  confirmEmail,
  resendConfirmationEmail,
  forgotPassword,
  resetPassword
} from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Route d'inscription
router.post('/register', register);

// Route de connexion
router.post('/login', login);

// Confirmation de l'email
router.get('/confirm/:token', confirmEmail);

// Renvoyer l'email de confirmation
router.post('/resend-confirmation', resendConfirmationEmail);

// Mot de passe oublié
router.post('/forgot-password', forgotPassword);

// Réinitialisation du mot de passe
router.post('/reset-password/:token', resetPassword);

// Déconnexion
router.post('/logout', logout);

// Récupérer les informations de l'utilisateur connecté
router.get('/me', authMiddleware, getMe);

export default router;