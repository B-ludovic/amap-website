import express from 'express';
import { getPublicStats } from '../controllers/stats.controller.js';

const router = express.Router();

// Route publique - chiffres agrégés affichés sur les pages vitrine
router.get('/', getPublicStats);

export default router;
