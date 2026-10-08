import { Router } from 'express';
import { listForms, getForm, createForm, updateForm, deleteForm, getEmbedInfo } from '../controllers/formController';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.use(requireAuth);

router.get('/', listForms);
router.post('/', requireRole('owner', 'manager'), createForm);
router.get('/:id', getForm);
router.patch('/:id', requireRole('owner', 'manager'), updateForm);
router.delete('/:id', requireRole('owner', 'manager'), deleteForm);
router.get('/:id/embed', getEmbedInfo);

export default router;
