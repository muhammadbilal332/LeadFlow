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
  qualifyLeadAi,
  getLatestAiQualification,
  importLeads,
  exportLeads,
  listDuplicates,
  mergeLeadsHandler,
} from '../controllers/leadController';
import { listQuotations, createLeadQuotation, updateLeadQuotation } from '../controllers/quotationController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/export', exportLeads);
router.post('/import', importLeads);
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

router.post('/:id/qualify-ai', qualifyLeadAi);
router.get('/:id/ai-qualification', getLatestAiQualification);

router.get('/:id/quotations', listQuotations);
router.post('/:id/quotations', createLeadQuotation);
router.patch('/:id/quotations/:quotationId', updateLeadQuotation);

export default router;
