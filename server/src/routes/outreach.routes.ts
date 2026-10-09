import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireAuthOrApiKey } from '../middleware/requireAuthOrApiKey';
import { requireRole } from '../middleware/requireRole';
import * as contacts from '../controllers/outreachContactController';
import * as sequences from '../controllers/outreachSequenceController';
import * as drafts from '../controllers/outreachDraftController';
import * as messages from '../controllers/outreachMessageController';
import * as replies from '../controllers/outreachReplyController';
import * as providers from '../controllers/outreachProviderController';
import * as suppressions from '../controllers/suppressionController';
import * as sheetImports from '../controllers/sheetController';
import * as emailSettings from '../controllers/emailSettingsController';
import { tick } from '../controllers/outreachTickController';
import { getFollowUpQueue, generateFollowUpDraft } from '../controllers/followUpQueueController';
import { listInbox, getThreadConversation } from '../controllers/inboxController';

const router = Router();

// The tick endpoint is the one route an external scheduler (currently a
// GitHub Actions scheduled workflow) calls directly, authenticated with a
// business API key instead of a user session.
router.post('/tick', requireAuthOrApiKey, tick);

router.use(requireAuth);

router.get('/contacts', contacts.listContacts);
// Manually adding a one-off contact sits outside any CRM lead, so a sales
// user (whose Contacts view is scoped to their assigned leads) has no
// legitimate use for it — same Manager+/Owner rule as sheet import.
router.post('/contacts', requireRole('owner', 'manager'), contacts.createContact);
router.get('/contacts/:id', contacts.getContact);
router.delete('/contacts/:id', requireRole('owner', 'manager'), contacts.deleteContact);

// Sequence templates are a business-wide configuration concept (they back
// bulk sheet-import campaigns), not something scoped to one sales user's
// leads — Manager+/Owner only, same as creating/editing one.
router.get('/sequences', requireRole('owner', 'manager'), sequences.listSequences);
router.post('/sequences', requireRole('owner', 'manager'), sequences.createSequence);
router.get('/sequences/:id', requireRole('owner', 'manager'), sequences.getSequence);
router.patch('/sequences/:id', requireRole('owner', 'manager'), sequences.updateSequence);
router.delete('/sequences/:id', requireRole('owner', 'manager'), sequences.deleteSequence);

router.get('/drafts', drafts.listDrafts);
router.get('/drafts/:id', drafts.getDraft);
router.patch('/drafts/:id', drafts.updateDraft);
router.post('/drafts/:id/approve', drafts.approveDraft);
router.post('/drafts/:id/reject', drafts.rejectDraft);
router.post('/drafts/:id/regenerate', drafts.regenerateDraft);

// Unscoped, business-wide message/event feeds — the per-lead-scoped
// equivalent sales actually uses is GET /sent (listSentMessages).
router.get('/messages', requireRole('owner', 'manager'), messages.listMessages);
router.get('/sent', messages.listSentMessages);
router.get('/events', requireRole('owner', 'manager'), messages.listEvents);

router.get('/replies', replies.listReplies);
router.post('/dev/simulate-reply', replies.simulateReply);

router.get('/follow-up-queue', getFollowUpQueue);
router.post('/campaign-contacts/:campaignContactId/generate-draft', generateFollowUpDraft);

router.get('/inbox', listInbox);
router.get('/threads/:threadId', getThreadConversation);

router.get('/providers', requireRole('owner', 'manager'), providers.getProviders);
router.get('/usage', requireRole('owner', 'manager'), providers.getUsage);

// The suppression list is business-wide do-not-contact data, not scoped to
// any one sales user's leads — Manager+/Owner only.
router.get('/suppressions', requireRole('owner', 'manager'), suppressions.listSuppressions);
router.post('/suppressions', requireRole('owner', 'manager'), suppressions.addSuppression);
router.delete('/suppressions/:email', requireRole('owner', 'manager'), suppressions.removeSuppression);

router.get('/imports', requireRole('owner', 'manager'), sheetImports.listImports);
// Sheets/CSV import is a Manager+/Owner capability (item 16/17 of the CRM
// permission model) — an Outreach Specialist must not be able to bulk-import
// contacts even by calling this endpoint directly.
router.post('/imports', requireRole('owner', 'manager'), sheetImports.triggerImport);

router.get('/settings', requireRole('owner', 'manager'), emailSettings.getSettings);
router.patch('/settings', requireRole('owner', 'manager'), emailSettings.updateSettings);

export default router;
