import { Router } from 'express';
import { getReports } from '../controllers/reportController';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.get('/', requireAuth, requireRole('owner', 'manager'), getReports);

export default router;
