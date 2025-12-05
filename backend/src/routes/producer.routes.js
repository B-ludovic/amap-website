import express from 'express';
import {
  getAllProducers,
  getProducerById,
} from '../controllers/producers.controller.js';

const router = express.Router();

// Routes publiques - tout le monde peut voir les producteurs
router.get('/', getAllProducers);
router.get('/:id', getProducerById);

export default router;