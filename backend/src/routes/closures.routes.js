import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { adminOnly } from '../middlewares/role.middleware.js';
import { getAllClosures, createClosure, deleteClosure } from '../controllers/closures.controller.js';

const router = Router();

router.get('/', authMiddleware, adminOnly, getAllClosures);
router.post('/', authMiddleware, adminOnly, createClosure);
router.delete('/:id', authMiddleware, adminOnly, deleteClosure);

export default router;
