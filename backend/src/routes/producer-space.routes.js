import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { producerOnly } from '../middlewares/role.middleware.js';
import {
  getOwnFarm,
  updateOwnFarm,
  getOwnProducts,
  createOwnProduct,
  updateOwnProduct,
  requestProductDeletion,
  cancelProductDeletion,
  getOwnAbsences,
  createOwnAbsence,
  updateOwnAbsence,
  deleteOwnAbsence,
} from '../controllers/producer-space.controller.js';

const router = Router();

router.use(authMiddleware, producerOnly);

router.get('/farm', getOwnFarm);
router.put('/farm', updateOwnFarm);

router.get('/products', getOwnProducts);
router.post('/products', createOwnProduct);
router.put('/products/:id', updateOwnProduct);
router.post('/products/:id/deletion-request', requestProductDeletion);
router.delete('/products/:id/deletion-request', cancelProductDeletion);

router.get('/absences', getOwnAbsences);
router.post('/absences', createOwnAbsence);
router.put('/absences/:id', updateOwnAbsence);
router.delete('/absences/:id', deleteOwnAbsence);

export default router;
