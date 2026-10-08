import { Router } from 'express';
import { getDashboard, getPersonEmails, getPersonEmail } from '../controllers/dashboardController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, getDashboard);
router.get('/people/:userId/emails', requireAuth, getPersonEmails);
router.get('/people/:userId/emails/:messageId', requireAuth, getPersonEmail);

export default router;
