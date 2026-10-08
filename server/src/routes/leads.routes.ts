import { Router } from 'express';
import {
  listLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  listNotes,
  createLeadNote,
  listActivities,
  createLeadActivity,
  getLeadFollowUps,
  importLeads,
  exportLeads,
  listDuplicates,
  mergeLeadsHandler,
} from '../controllers/leadController';
import { listQuotations, createLeadQuotation, updateLeadQuotation } from '../controllers/quotationController';
import { getLeadEmailHistory, composeLeadEmail } from '../controllers/leadEmailController';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.use(requireAuth);

// Import/export touch bulk business data, not a single assigned lead — an
// Outreach Specialist (role 'sales') must not be able to pull or push the
// whole leads table, even by calling these endpoints directly rather than
// through a hidden UI control.
router.get('/export', requireRole('owner'), exportLeads);
router.post('/import', requireRole('owner', 'manager'), importLeads);
router.get('/duplicates', listDuplicates);
router.post('/merge', mergeLeadsHandler);

router.get('/', listLeads);
router.post('/', createLead);
router.get('/:id', getLead);
router.patch('/:id', updateLead);
router.delete('/:id', deleteLead);

router.get('/:id/notes', listNotes);
router.post('/:id/notes', createLeadNote);

router.get('/:id/activities', listActivities);
router.post('/:id/activities', createLeadActivity);

router.get('/:id/follow-ups', getLeadFollowUps);

router.get('/:id/email-history', getLeadEmailHistory);
router.get('/:id/compose-email', composeLeadEmail);


router.get('/:id/quotations', listQuotations);
router.post('/:id/quotations', createLeadQuotation);
router.patch('/:id/quotations/:quotationId', updateLeadQuotation);

export default router;
