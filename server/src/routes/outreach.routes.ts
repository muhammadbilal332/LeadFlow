import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireAuthOrApiKey } from '../middleware/requireAuthOrApiKey';
import { requireRole } from '../middleware/requireRole';
import * as contacts from '../controllers/outreachContactController';
import * as sequences from '../controllers/outreachSequenceController';
import * as campaigns from '../controllers/outreachCampaignController';
import * as drafts from '../controllers/outreachDraftController';
import * as messages from '../controllers/outreachMessageController';
import * as replies from '../controllers/outreachReplyController';
import * as providers from '../controllers/outreachProviderController';
import * as suppressions from '../controllers/suppressionController';
import * as sheetImports from '../controllers/sheetController';
import * as emailSettings from '../controllers/emailSettingsController';
import { tick } from '../controllers/outreachTickController';

const router = Router();

// The tick endpoint is the one route n8n (or any scheduler) calls directly,
// authenticated with a business API key instead of a user session.
router.post('/tick', requireAuthOrApiKey, tick);

router.use(requireAuth);

router.get('/contacts', contacts.listContacts);
router.post('/contacts', contacts.createContact);
router.get('/contacts/:id', contacts.getContact);
router.delete('/contacts/:id', requireRole('owner'), contacts.deleteContact);

router.get('/sequences', sequences.listSequences);
router.post('/sequences', requireRole('owner'), sequences.createSequence);
router.get('/sequences/:id', sequences.getSequence);
router.patch('/sequences/:id', requireRole('owner'), sequences.updateSequence);
router.delete('/sequences/:id', requireRole('owner'), sequences.deleteSequence);

router.get('/campaigns', campaigns.listCampaigns);
router.post('/campaigns', requireRole('owner'), campaigns.createCampaign);
router.get('/campaigns/:id', campaigns.getCampaign);
router.patch('/campaigns/:id', requireRole('owner'), campaigns.updateCampaign);
router.delete('/campaigns/:id', requireRole('owner'), campaigns.deleteCampaign);
router.post('/campaigns/:id/contacts', requireRole('owner'), campaigns.addContacts);
router.post('/campaigns/:id/generate-drafts', requireRole('owner'), campaigns.generateDrafts);
router.post('/campaigns/:id/approve', requireRole('owner'), campaigns.approveCampaign);
router.post('/campaigns/:id/start', requireRole('owner'), campaigns.startCampaign);
router.post('/campaigns/:id/pause', requireRole('owner'), campaigns.pauseCampaign);
router.post('/campaigns/:id/cancel', requireRole('owner'), campaigns.cancelCampaign);

router.get('/drafts', drafts.listDrafts);
router.get('/drafts/:id', drafts.getDraft);
router.patch('/drafts/:id', drafts.updateDraft);
router.post('/drafts/:id/approve', drafts.approveDraft);
router.post('/drafts/:id/reject', drafts.rejectDraft);
router.post('/drafts/:id/regenerate', drafts.regenerateDraft);

router.get('/messages', messages.listMessages);
router.get('/events', messages.listEvents);

router.get('/replies', replies.listReplies);
router.post('/dev/simulate-reply', replies.simulateReply);

router.get('/providers', providers.getProviders);
router.get('/usage', providers.getUsage);

router.get('/suppressions', suppressions.listSuppressions);
router.post('/suppressions', suppressions.addSuppression);
router.delete('/suppressions/:email', suppressions.removeSuppression);

router.get('/imports', sheetImports.listImports);
router.post('/imports', sheetImports.triggerImport);

router.get('/settings', emailSettings.getSettings);
router.patch('/settings', requireRole('owner'), emailSettings.updateSettings);

export default router;
