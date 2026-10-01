import { Router } from 'express';
import { listFollowUps, createFollowUp, updateFollowUpHandler } from '../controllers/followUpController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', listFollowUps);
router.post('/', createFollowUp);
router.patch('/:id', updateFollowUpHandler);

export default router;
