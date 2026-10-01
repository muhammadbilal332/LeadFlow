import { Router } from 'express';
import { signup, login, me } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/signup', authLimiter, signup);
router.post('/login', authLimiter, login);
router.get('/me', requireAuth, me);

export default router;
