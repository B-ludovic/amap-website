import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { adminOnly } from '../middlewares/role.middleware.js';
import {
  getAllProducerAbsences,
  createProducerAbsence,
  updateProducerAbsence,
  deleteProducerAbsence
} from '../controllers/producer-absences.controller.js';

const router = Router();

/* Réservé à l'administration : savoir qu'une ferme est en congés ne regarde pas
   le public, seul le contenu du panier qui en découle est publié. */
router.get('/', authMiddleware, adminOnly, getAllProducerAbsences);
router.post('/', authMiddleware, adminOnly, createProducerAbsence);
router.put('/:id', authMiddleware, adminOnly, updateProducerAbsence);
router.delete('/:id', authMiddleware, adminOnly, deleteProducerAbsence);

export default router;
