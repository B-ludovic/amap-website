import express from 'express';
import { getActiveTheme } from '../controllers/admin.controller.js';

const router = express.Router();

// Route publique pour récupérer le thème actif
router.get('/active', getActiveTheme);

export default router;
