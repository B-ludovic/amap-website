import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';
import { getAllClosures, createClosure, deleteClosure } from '../controllers/closures.controller.js';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/', getAllClosures);
router.post('/', createClosure);
router.delete('/:id', deleteClosure);

export default router;
