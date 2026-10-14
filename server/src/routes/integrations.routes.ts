import { Router } from 'express';
import {
  getIntegrationsOverview,
  createOrRotateWebhook,
  setWebhookActiveHandler,
  listWebhookDeliveries,
  configureMeta,
  disconnectMeta,
} from '../controllers/integrationController';
import { getConnection, upsertConnection, disconnectConnection } from '../controllers/sheetController';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { requireTargetBusiness } from '../middleware/requireTargetBusiness';

const router = Router();

// Integrations management is developer-only (see docs/DEVELOPER_DASHBOARD.md
// and docs/INTEGRATIONS.md) — the business owner no longer has a page or an
// API path to this. requireTargetBusiness lets the developer's platform-wide
// account specify, per request, which real business it's acting on.
router.use(requireAuth, requireRole('developer'), requireTargetBusiness);

router.get('/', getIntegrationsOverview);

router.post('/webhook', createOrRotateWebhook);
router.patch('/webhook', setWebhookActiveHandler);
router.get('/webhook/deliveries', listWebhookDeliveries);

router.post('/meta', configureMeta);
router.delete('/meta', disconnectMeta);

router.get('/google-sheets', getConnection);
router.post('/google-sheets', upsertConnection);
router.delete('/google-sheets', disconnectConnection);

export default router;
