import express from 'express';
import {
  register,
  login,
  logout,
  getMe,
  exportMe,
  deleteMe,
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

/* Confirmation de l'email — en POST, et non en GET.
   Le lien du message ouvre une page du site, pas cette route. Mais certaines
   passerelles de messagerie d'entreprise ouvrent les liens dans un navigateur
   sans tête pour les inspecter, JavaScript compris : une confirmation déclenchée
   au chargement de la page serait consommée par l'inspection, et l'adhérent
   trouverait un lien mort en arrivant. Aucune de ces passerelles ne fabrique de
   requête POST, qui reste donc réservée à un geste humain. */
router.post('/confirm/:token', confirmEmail);

// Renvoyer l'email de confirmation
router.post('/resend-confirmation', resendConfirmationEmail);

// Mot de passe oublié
router.post('/forgot-password', forgotPassword);

// Réinitialisation du mot de passe
router.post('/reset-password', resetPassword);

// Déconnexion — authMiddleware pose req.user, sans quoi la révocation du token est ignorée
router.post('/logout', authMiddleware, logout);

// Récupérer les informations de l'utilisateur connecté
router.get('/me', authMiddleware, getMe);

// Export des données personnelles (RGPD art. 20)
router.get('/me/export', authMiddleware, exportMe);

// Suppression du compte (RGPD art. 17)
router.delete('/me', authMiddleware, deleteMe);

export default router;