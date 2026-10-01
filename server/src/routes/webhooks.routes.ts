import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { receiveGenericWebhook, verifyMetaWebhook, receiveMetaWebhook } from '../controllers/webhookIntakeController';
import { receiveInboundEmail, receiveDeliveryStatus } from '../controllers/emailWebhookController';

const router = Router();

// These endpoints are called by external services (n8n, Meta), not by the
// LeadFlow frontend, so they intentionally do NOT use requireAuth/JWT.
// Each verifies its own credential: a per-business secret for the generic
// webhook, and Meta's X-Hub-Signature-256 for the Meta webhook.
const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(webhookLimiter);

router.post('/leads', receiveGenericWebhook);

router.get('/meta/leads', verifyMetaWebhook);
router.post('/meta/leads', receiveMetaWebhook);

router.post('/email/:businessId/inbound', receiveInboundEmail);
router.post('/email/:businessId/status', receiveDeliveryStatus);

export default router;
