import express from 'express';
import { runJobsTick } from '../controllers/jobs.controller.js';

const router = express.Router();

router.post('/tick', runJobsTick);

export default router;
