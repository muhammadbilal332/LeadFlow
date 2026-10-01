import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getPublicForm, submitPublicForm } from '../controllers/formController';

const router = Router();

// Public, unauthenticated routes — anyone on the internet can hit these, so
// they get their own (tighter) rate limit and never touch req.user.
const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions, please try again later.' },
});

router.use(publicFormLimiter);

router.get('/forms/:businessSlug/:formSlug', getPublicForm);
router.post('/forms/:businessSlug/:formSlug/submit', submitPublicForm);

export default router;
