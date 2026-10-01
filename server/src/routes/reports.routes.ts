import { Router } from 'express';
import { getReports } from '../controllers/reportController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, getReports);

export default router;
