import { Router } from 'express';
import { getBusiness, updateBusinessHandler } from '../controllers/businessController';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.use(requireAuth);

router.get('/', getBusiness);
router.patch('/', requireRole('owner'), updateBusinessHandler);

export default router;
