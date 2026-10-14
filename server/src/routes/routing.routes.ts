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
import { requireTargetBusiness } from '../middleware/requireTargetBusiness';

const router = Router();

// Lead routing management is developer-only (see docs/DEVELOPER_DASHBOARD.md)
// — the business owner no longer has a page or an API path to this.
// requireTargetBusiness lets the developer's platform-wide account specify,
// per request, which real business it's acting on.
router.use(requireAuth, requireRole('developer'), requireTargetBusiness);

router.get('/rules', listRoutingRules);
router.post('/rules', createRoutingRule);
router.patch('/rules/:id', updateRoutingRule);
router.delete('/rules/:id', deleteRoutingRule);

router.get('/sla', getSlaSettings);
router.patch('/sla', updateSlaSettings);

export default router;
