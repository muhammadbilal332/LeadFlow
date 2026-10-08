import { Router } from 'express';
import { listUsers, createSalesUser, updateUserHandler } from '../controllers/userController';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.use(requireAuth);

// Manager can see the team (needed to assign leads to team members) but not
// create, edit, or deactivate accounts — that stays Owner-only.
router.get('/', requireRole('owner', 'manager'), listUsers);
router.post('/', requireRole('owner'), createSalesUser);
router.patch('/:id', requireRole('owner'), updateUserHandler);

export default router;
