import { Router } from 'express';
import { listAutomationRules, createAutomationRule, updateAutomationRule, deleteAutomationRule } from '../controllers/automationController';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.use(requireAuth, requireRole('owner'));

router.get('/', listAutomationRules);
router.post('/', createAutomationRule);
router.patch('/:id', updateAutomationRule);
router.delete('/:id', deleteAutomationRule);

export default router;
