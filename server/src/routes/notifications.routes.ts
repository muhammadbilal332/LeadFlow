import { Router } from 'express';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '../controllers/notificationController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', listNotifications);
router.patch('/:id/read', markNotificationRead);
router.post('/read-all', markAllNotificationsRead);

export default router;
