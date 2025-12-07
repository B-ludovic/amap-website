import express from 'express';
import {
  getAllShifts,
  getShiftById,
  createShift,
  updateShift,
  deleteShift,
  joinShift,
  leaveShift,
  markVolunteerAbsent,
  getMyShifts,
  duplicateShift
} from '../controllers/shifts.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { adminOnly } from '../middlewares/role.middleware.js';

const router = express.Router();

// Routes publiques (lecture seule pour adhérents)
router.get('/', authMiddleware, getAllShifts);
router.get('/my-shifts', authMiddleware, getMyShifts);
router.get('/:id', authMiddleware, getShiftById);

// S'inscrire / Se désister (adhérents)
router.post('/:id/join', authMiddleware, joinShift);
router.delete('/:id/leave', authMiddleware, leaveShift);

// Routes admin uniquement
router.post('/', authMiddleware, adminOnly, createShift);
router.post('/:id/duplicate', authMiddleware, adminOnly, duplicateShift);
router.put('/:id', authMiddleware, adminOnly, updateShift);
router.delete('/:id', authMiddleware, adminOnly, deleteShift);
router.put('/:shiftId/volunteer/:volunteerId/absent', authMiddleware, adminOnly, markVolunteerAbsent);

export default router;