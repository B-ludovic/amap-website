import express from 'express';
import {
  receiveBrevoEvent,
  getEmailLogs,
  getEmailSummary,
  getSuppressions,
  deleteSuppression,
} from '../controllers/emails.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { adminOnly } from '../middlewares/role.middleware.js';

const router = express.Router();

/* Le webhook passe avant le mur d'authentification : Brevo n'a pas de compte
   sur le site et ne saura jamais ouvrir de session. C'est le secret partagé de
   l'URL qui l'autorise (voir emails.controller.js). */
router.post('/brevo', receiveBrevoEvent);

// Tout ce qui suit est la consultation, réservée aux administrateurs.
router.use(authMiddleware, adminOnly);

router.get('/', getEmailLogs);
router.get('/summary', getEmailSummary);
router.get('/suppressions', getSuppressions);
router.delete('/suppressions/:id', deleteSuppression);

export default router;
