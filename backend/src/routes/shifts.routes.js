import express from 'express';
import {
  getAllShifts,
  getShiftById,
  createShift,
  updateShift,
  deleteShift,
  proposeShift,
  leaveShift,
  updateVolunteerStatus,
  getPendingProposals,
  acceptProposal,
  refuseProposal,
  getMyShifts,
  duplicateShift
} from '../controllers/shifts.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { adminOnly } from '../middlewares/role.middleware.js';

const router = express.Router();

// Routes publiques (lecture seule pour adhérents)
router.get('/', authMiddleware, getAllShifts);
router.get('/my-shifts', authMiddleware, getMyShifts);
// Avant '/:id', qui prendrait « proposals » pour un identifiant.
router.get('/proposals', authMiddleware, adminOnly, getPendingProposals);
router.get('/:id', authMiddleware, getShiftById);

// Se proposer / Se désister (adhérents)
router.post('/:id/propose', authMiddleware, proposeShift);
router.delete('/:id/leave', authMiddleware, leaveShift);

// Routes admin uniquement
router.post('/', authMiddleware, adminOnly, createShift);
router.post('/:id/duplicate', authMiddleware, adminOnly, duplicateShift);
router.put('/:id', authMiddleware, adminOnly, updateShift);
router.delete('/:id', authMiddleware, adminOnly, deleteShift);
router.put('/:shiftId/volunteers/:userId', authMiddleware, adminOnly, updateVolunteerStatus);
router.post('/:shiftId/volunteers/:userId/accept', authMiddleware, adminOnly, acceptProposal);
router.post('/:shiftId/volunteers/:userId/refuse', authMiddleware, adminOnly, refuseProposal);

export default router;
