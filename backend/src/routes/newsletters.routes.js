import express from 'express';
import {
  getAllNewsletters,
  getNewsletterById,
  createNewsletter,
  updateNewsletter,
  deleteNewsletter,
  sendNewsletter,
  scheduleNewsletter,
  getNewsletterStats
} from '../controllers/newsletters.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { adminOnly } from '../middlewares/role.middleware.js';

const router = express.Router();

// Toutes les routes nécessitent d'être admin
router.use(authMiddleware, adminOnly);

router.get('/', getAllNewsletters);
router.get('/stats', getNewsletterStats);
router.get('/:id', getNewsletterById);
router.post('/', createNewsletter);
router.put('/:id', updateNewsletter);
router.delete('/:id', deleteNewsletter);
router.post('/:id/send', sendNewsletter);
router.post('/:id/schedule', scheduleNewsletter);

export default router;