import { Router } from 'express';
import { listUsers, createSalesUser, updateUserHandler } from '../controllers/userController';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.use(requireAuth);

router.get('/', requireRole('owner'), listUsers);
router.post('/', requireRole('owner'), createSalesUser);
router.patch('/:id', requireRole('owner'), updateUserHandler);

export default router;
