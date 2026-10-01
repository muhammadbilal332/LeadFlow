import { Router } from 'express';
import {
  listRoutingRules,
  createRoutingRule,
  updateRoutingRule,
  deleteRoutingRule,
  getSlaSettings,
  updateSlaSettings,
} from '../controllers/routingController';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.use(requireAuth, requireRole('owner'));

router.get('/rules', listRoutingRules);
router.post('/rules', createRoutingRule);
router.patch('/rules/:id', updateRoutingRule);
router.delete('/rules/:id', deleteRoutingRule);

router.get('/sla', getSlaSettings);
router.patch('/sla', updateSlaSettings);

export default router;
