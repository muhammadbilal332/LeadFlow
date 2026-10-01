import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import * as developer from '../controllers/developerController';

const router = Router();

// Every /api/developer/* route independently verifies the caller's role —
// frontend route protection is not trusted as the security boundary.
// Anonymous -> 401 (requireAuth). Sales/owner -> 403 (requireRole).
router.use(requireAuth, requireRole('developer'));

router.get('/overview', developer.getOverview);

router.get('/businesses', developer.listBusinesses);
router.get('/businesses/:id', developer.getBusiness);
router.post('/businesses/:id/deactivate', developer.deactivateBusiness);
router.post('/businesses/:id/reactivate', developer.reactivateBusiness);
router.delete('/businesses/:id', developer.deleteBusinessHandler);

router.get('/users', developer.listUsers);
router.patch('/users/:id/role', developer.changeUserRole);
router.patch('/users/:id/status', developer.setUserStatus);

router.get('/leads', developer.listLeads);

router.get('/outreach', developer.getOutreach);
router.get('/n8n', developer.getN8n);
router.get('/health', developer.getHealth);
router.get('/providers', developer.getProviders);
router.get('/usage', developer.getUsage);
router.get('/logs', developer.getLogs);
router.get('/audit', developer.getAuditLogs);

export default router;
