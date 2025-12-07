import express from 'express';
import {
  getDistributionList,
  markAsPickedUp,
  getDistributionStats,
  exportDistributionList
} from '../controllers/distribution.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { adminOnly } from '../middlewares/role.middleware.js';

const router = express.Router();

// Toutes les routes nécessitent admin ou bénévole
router.use(authMiddleware);

router.get('/list/:weeklyBasketId', getDistributionList);
router.put('/pickup/:pickupId', markAsPickedUp);
router.get('/stats/:weeklyBasketId', getDistributionStats);
router.get('/export/:weeklyBasketId', exportDistributionList);

export default router;