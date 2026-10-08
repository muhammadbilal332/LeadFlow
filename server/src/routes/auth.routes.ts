import { Router } from 'express';
import { login, me } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/login', authLimiter, login);
router.get('/me', requireAuth, me);

export default router;
