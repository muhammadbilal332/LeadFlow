import { Router } from 'express';
import { listApiKeys, createApiKey, revokeApiKey } from '../controllers/apiKeyController';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.use(requireAuth, requireRole('owner'));

router.get('/', listApiKeys);
router.post('/', createApiKey);
router.delete('/:id', revokeApiKey);

export default router;
