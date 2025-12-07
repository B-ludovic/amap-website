import express from 'express';
import {
  submitInquiry,
  getAllInquiries,
  getInquiryById,
  updateInquiryStatus,
  deleteInquiry
} from '../controllers/producer-inquiries.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { adminOnly } from '../middlewares/role.middleware.js';

const router = express.Router();

// Route publique - formulaire "Devenir producteur"
router.post('/', submitInquiry);

// Routes admin
router.get('/', authMiddleware, adminOnly, getAllInquiries);
router.get('/:id', authMiddleware, adminOnly, getInquiryById);
router.put('/:id/status', authMiddleware, adminOnly, updateInquiryStatus);
router.delete('/:id', authMiddleware, adminOnly, deleteInquiry);

export default router;