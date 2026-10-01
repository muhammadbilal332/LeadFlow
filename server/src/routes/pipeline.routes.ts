import { Router } from 'express';
import { getPipeline } from '../controllers/pipelineController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, getPipeline);

export default router;
