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

const router = Router();

router.use(requireAuth, requireRole('owner'));

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
