import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestDatabase } from './testDb';
import { createApp } from '../src/app';
import { signupOwner } from './helpers';

describe('Outreach platform (mock providers, full pipeline)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('reports every provider as mock and configured by default', async () => {
    const owner = await signupOwner(app);
    const res = await request(app).get('/api/outreach/providers').set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.body.providers.email).toEqual({ name: 'mock', configured: true, selected: 'mock' });
    expect(res.body.providers.ai).toEqual({ name: 'mock', configured: true, selected: 'mock' });
    expect(res.body.providers.sheets).toEqual({ name: 'mock', configured: true, selected: 'mock' });
    expect(res.body.providers.inbound).toEqual({ name: 'mock', configured: true, selected: 'mock' });
  });

  it('runs the streamlined outreach flow: import -> sequence -> campaign -> auto-draft -> approve -> auto-send on start -> reply -> lead conversion', async () => {
    const owner = await signupOwner(app);
    const auth = { Authorization: `Bearer ${owner.token}` };

    // 1. Configure sender defaults.
    const settingsRes = await request(app)
      .patch('/api/outreach/settings')
      .set(auth)
      .send({ defaultSenderName: 'Alex from LeadFlow', defaultSenderEmail: 'alex@leadflow-demo.test', dailySendLimit: 50 });
    expect(settingsRes.status).toBe(200);

    // 2. Import contacts from the mock Google Sheet. skipAutoCampaign is
    // used here since this test exercises the fully-manual path (its own
    // sequence/campaign/add-contacts steps below) — the default, auto-pilot
    // behavior is covered separately by the "auto-pilot" test.
    const importRes = await request(app).post('/api/outreach/imports').set(auth).send({ skipAutoCampaign: true });
    expect(importRes.status).toBe(201);
    expect(importRes.body.import.imported_rows).toBeGreaterThan(0);

    // 3. Verify contacts were created.
    const contactsRes = await request(app).get('/api/outreach/contacts').set(auth);
    expect(contactsRes.status).toBe(200);
    const targetContact = contactsRes.body.contacts.find((c: any) => c.email === 'dana@brightleafroasters.test');
    expect(targetContact).toBeTruthy();

    // 4. Re-running the import must not create duplicate contacts.
    const secondImportRes = await request(app).post('/api/outreach/imports').set(auth).send({ skipAutoCampaign: true });
    expect(secondImportRes.body.import.duplicate_rows).toBeGreaterThan(0);
    const contactsAfterSecondImport = await request(app).get('/api/outreach/contacts').set(auth);
    expect(contactsAfterSecondImport.body.total).toBe(contactsRes.body.total);

    // 5. Create a 2-step sequence.
    const sequenceRes = await request(app)
      .post('/api/outreach/sequences')
      .set(auth)
      .send({
        name: 'Cold Intro',
        steps: [
          { stepOrder: 1, delayDays: 0, subjectTemplate: 'intro', aiPersonalize: true },
          { stepOrder: 2, delayDays: 3, subjectTemplate: 'follow-up', aiPersonalize: true },
        ],
      });
    expect(sequenceRes.status).toBe(201);
    const sequenceId = sequenceRes.body.sequence.id;

    // 6. Create a campaign and attach the sequence.
    const campaignRes = await request(app)
      .post('/api/outreach/campaigns')
      .set(auth)
      .send({ name: 'Q1 Cold Outreach', senderName: 'Alex', senderEmail: 'alex@leadflow-demo.test', sequenceId });
    expect(campaignRes.status).toBe(201);
    expect(campaignRes.body.campaign.status).toBe('draft');
    const campaignId = campaignRes.body.campaign.id;

    // 7. Adding the contact must immediately produce its step-1 draft — no
    // separate "generate drafts" click required — but must NOT send anything.
    const addContactsRes = await request(app)
      .post(`/api/outreach/campaigns/${campaignId}/contacts`)
      .set(auth)
      .send({ contactIds: [targetContact.id] });
    expect(addContactsRes.status).toBe(200);
    expect(addContactsRes.body.added).toBe(1);
    expect(addContactsRes.body.draftsGenerated).toBe(1);

    const messagesBeforeApproval = await request(app).get('/api/outreach/messages').set(auth);
    expect(messagesBeforeApproval.body.messages).toHaveLength(0);

    // 8. Review the draft.
    const draftsRes = await request(app).get('/api/outreach/drafts').set(auth);
    expect(draftsRes.status).toBe(200);
    expect(draftsRes.body.drafts).toHaveLength(1);
    const draft = draftsRes.body.drafts[0];
    expect(draft.subject).toBeTruthy();
    expect(draft.naturalized_body).toContain('Dana');
    expect(draft.quality_status).not.toBe('blocked');

    // 9. A campaign cannot be started before being approved.
    const startTooEarlyRes = await request(app).post(`/api/outreach/campaigns/${campaignId}/start`).set(auth).send({});
    expect(startTooEarlyRes.status).toBe(400);

    // 10. Approve the draft — required before ANY send. The campaign is
    // still only 'review' at this point (not yet started), so approving
    // does not send it immediately — it waits for the campaign to start.
    const approveDraftRes = await request(app).post(`/api/outreach/drafts/${draft.id}/approve`).set(auth).send({});
    expect(approveDraftRes.status).toBe(200);
    expect(approveDraftRes.body.draft.status).toBe('approved');
    expect(approveDraftRes.body.sendOutcome).toBe('not_running');

    // 11. Approve the campaign, then start it — starting immediately sends
    // every already-approved draft, so no separate "process queue" click is
    // needed for the common case.
    const approveCampaignRes = await request(app).post(`/api/outreach/campaigns/${campaignId}/approve`).set(auth).send({});
    expect(approveCampaignRes.status).toBe(200);
    expect(approveCampaignRes.body.campaign.status).toBe('approved');

    const startRes = await request(app).post(`/api/outreach/campaigns/${campaignId}/start`).set(auth).send({});
    expect(startRes.status).toBe(200);
    expect(startRes.body.campaign.status).toBe('running');
    expect(startRes.body.tickResult.sent).toBe(1);

    // 12. The email was actually sent and (mock) delivered.
    const messagesAfterSend = await request(app).get('/api/outreach/messages').set(auth);
    expect(messagesAfterSend.body.messages).toHaveLength(1);
    expect(messagesAfterSend.body.messages[0].status).toBe('delivered');

    const usageRes = await request(app).get('/api/outreach/usage').set(auth);
    expect(usageRes.body.usage.sentToday).toBe(1);

    // 13. A retried tick must not double-send (idempotency) — this is the
    // endpoint n8n calls on a schedule.
    const secondTickRes = await request(app).post('/api/outreach/tick').set(auth).send({});
    expect(secondTickRes.body.result.sent).toBe(0);
    const messagesAfterRetry = await request(app).get('/api/outreach/messages').set(auth);
    expect(messagesAfterRetry.body.messages).toHaveLength(1);

    // 14. Simulate an "interested" reply — this must stop follow-ups and
    // ensure a lead exists. The sheet import back in step 2 already created
    // a CRM lead for Dana (every imported contact gets one now), so this
    // reply reuses and links to that existing lead rather than creating a
    // second, duplicate one — leadCreated is correctly false here.
    const replyRes = await request(app)
      .post('/api/outreach/dev/simulate-reply')
      .set(auth)
      .send({ fromEmail: 'dana@brightleafroasters.test', body: 'Thanks for reaching out — sounds interesting, tell me more!' });
    expect(replyRes.status).toBe(201);
    expect(replyRes.body.result.classification).toBe('interested');
    expect(replyRes.body.result.leadCreated).toBe(false);

    const leadsRes = await request(app).get('/api/leads?search=Dana').set(auth);
    expect(leadsRes.body.leads).toHaveLength(1);
    expect(leadsRes.body.leads[0].email).toBe('dana@brightleafroasters.test');

    // 15. Because a reply was received, the campaign contact must stop — the
    // next tick must NOT generate a step-2 follow-up draft for this contact.
    const campaignDetailRes = await request(app).get(`/api/outreach/campaigns/${campaignId}`).set(auth);
    expect(campaignDetailRes.body.contacts[0].status).toBe('stopped');

    const thirdTickRes = await request(app).post('/api/outreach/tick').set(auth).send({});
    expect(thirdTickRes.body.result.draftsGenerated).toBe(0);
  });

  it('blocks a send once a recipient is suppressed before the campaign starts', async () => {
    const owner = await signupOwner(app);
    const auth = { Authorization: `Bearer ${owner.token}` };

    await request(app).patch('/api/outreach/settings').set(auth).send({ defaultSenderEmail: 'sender@leadflow-demo.test' });

    const contactRes = await request(app)
      .post('/api/outreach/contacts')
      .set(auth)
      .send({ email: 'prospect@suppress-demo.test', contactName: 'Sam Prospect', companyName: 'Suppress Co' });
    expect(contactRes.status).toBe(201);

    const sequenceRes = await request(app)
      .post('/api/outreach/sequences')
      .set(auth)
      .send({ name: 'Single Step', steps: [{ stepOrder: 1, delayDays: 0, subjectTemplate: 'hi' }] });

    const campaignRes = await request(app)
      .post('/api/outreach/campaigns')
      .set(auth)
      .send({ name: 'Suppression Test', senderEmail: 'sender@leadflow-demo.test', sequenceId: sequenceRes.body.sequence.id });
    const campaignId = campaignRes.body.campaign.id;

    await request(app).post(`/api/outreach/campaigns/${campaignId}/contacts`).set(auth).send({ contactIds: [contactRes.body.contact.id] });
    const draftsRes = await request(app).get('/api/outreach/drafts').set(auth);
    const draftId = draftsRes.body.drafts[0].id;
    await request(app).post(`/api/outreach/drafts/${draftId}/approve`).set(auth).send({});
    await request(app).post(`/api/outreach/campaigns/${campaignId}/approve`).set(auth).send({});

    // Suppress the recipient AFTER approval but BEFORE starting the
    // campaign. Adding a suppression immediately stops every in-flight
    // campaign_contact for that email (see suppressionService.suppress), so
    // this contact never reaches the send phase even though starting the
    // campaign triggers an immediate send attempt.
    const suppressRes = await request(app).post('/api/outreach/suppressions').set(auth).send({ email: 'prospect@suppress-demo.test', reason: 'manual' });
    expect(suppressRes.status).toBe(201);

    const campaignDetailRes = await request(app).get(`/api/outreach/campaigns/${campaignId}`).set(auth);
    expect(campaignDetailRes.body.contacts[0].status).toBe('stopped');

    const startRes = await request(app).post(`/api/outreach/campaigns/${campaignId}/start`).set(auth).send({});
    expect(startRes.body.tickResult.sent).toBe(0);

    const messagesRes = await request(app).get('/api/outreach/messages').set(auth);
    expect(messagesRes.body.messages).toHaveLength(0);
  });

  it('flags a draft as blocked when the recipient was already suppressed, and refuses to approve it', async () => {
    const owner = await signupOwner(app);
    const auth = { Authorization: `Bearer ${owner.token}` };

    await request(app).patch('/api/outreach/settings').set(auth).send({ defaultSenderEmail: 'sender@leadflow-demo.test' });
    await request(app).post('/api/outreach/suppressions').set(auth).send({ email: 'already-suppressed@leadflow-demo.test', reason: 'manual' });

    const contactRes = await request(app).post('/api/outreach/contacts').set(auth).send({ email: 'already-suppressed@leadflow-demo.test', contactName: 'Pre Suppressed' });
    const sequenceRes = await request(app).post('/api/outreach/sequences').set(auth).send({ name: 'Seq', steps: [{ stepOrder: 1, delayDays: 0, subjectTemplate: 'hi' }] });
    const campaignRes = await request(app)
      .post('/api/outreach/campaigns')
      .set(auth)
      .send({ name: 'Pre-suppressed Test', senderEmail: 'sender@leadflow-demo.test', sequenceId: sequenceRes.body.sequence.id });
    await request(app).post(`/api/outreach/campaigns/${campaignRes.body.campaign.id}/contacts`).set(auth).send({ contactIds: [contactRes.body.contact.id] });

    const draftsRes = await request(app).get('/api/outreach/drafts').set(auth);
    const draft = draftsRes.body.drafts[0];
    expect(draft.quality_status).toBe('blocked');
    expect(draft.quality_issues.some((i: any) => i.code === 'suppressed_recipient')).toBe(true);

    const approveRes = await request(app).post(`/api/outreach/drafts/${draft.id}/approve`).set(auth).send({});
    expect(approveRes.status).toBe(400);
  });

  it('classifies an unsubscribe reply and permanently suppresses the contact', async () => {
    const owner = await signupOwner(app);
    const auth = { Authorization: `Bearer ${owner.token}` };

    await request(app).patch('/api/outreach/settings').set(auth).send({ defaultSenderEmail: 'sender@leadflow-demo.test' });
    const sequenceRes = await request(app).post('/api/outreach/sequences').set(auth).send({ name: 'Seq', steps: [{ stepOrder: 1, delayDays: 0, subjectTemplate: 'hi' }] });
    const campaignRes = await request(app)
      .post('/api/outreach/campaigns')
      .set(auth)
      .send({ name: 'Unsub Test', senderEmail: 'sender@leadflow-demo.test', sequenceId: sequenceRes.body.sequence.id });
    const contactRes = await request(app)
      .post('/api/outreach/contacts')
      .set(auth)
      .send({ email: 'unsub2@leadflow-demo.test', contactName: 'Unsub Two' });
    await request(app).post(`/api/outreach/campaigns/${campaignRes.body.campaign.id}/contacts`).set(auth).send({ contactIds: [contactRes.body.contact.id] });
    const draftsRes = await request(app).get('/api/outreach/drafts').set(auth);
    await request(app).post(`/api/outreach/drafts/${draftsRes.body.drafts[0].id}/approve`).set(auth).send({});
    await request(app).post(`/api/outreach/campaigns/${campaignRes.body.campaign.id}/approve`).set(auth).send({});
    const startRes = await request(app).post(`/api/outreach/campaigns/${campaignRes.body.campaign.id}/start`).set(auth).send({});
    expect(startRes.body.tickResult.sent).toBe(1);

    const replyRes = await request(app)
      .post('/api/outreach/dev/simulate-reply')
      .set(auth)
      .send({ fromEmail: 'unsub2@leadflow-demo.test', body: 'Please unsubscribe me from this list, remove me.' });
    expect(replyRes.body.result.classification).toBe('unsubscribe');

    const suppressionsRes = await request(app).get('/api/outreach/suppressions').set(auth);
    expect(suppressionsRes.body.suppressions.some((s: any) => s.normalized_email === 'unsub2@leadflow-demo.test' && s.reason === 'unsubscribe')).toBe(true);
  });

  it('simulates a hard bounce and auto-suppresses the recipient', async () => {
    const owner = await signupOwner(app);
    const auth = { Authorization: `Bearer ${owner.token}` };

    await request(app).patch('/api/outreach/settings').set(auth).send({ defaultSenderEmail: 'sender@leadflow-demo.test' });
    const contactRes = await request(app).post('/api/outreach/contacts').set(auth).send({ email: 'willbounce@bounce-demo.test', contactName: 'Bouncy' });
    const sequenceRes = await request(app).post('/api/outreach/sequences').set(auth).send({ name: 'Seq', steps: [{ stepOrder: 1, delayDays: 0, subjectTemplate: 'hi' }] });
    const campaignRes = await request(app)
      .post('/api/outreach/campaigns')
      .set(auth)
      .send({ name: 'Bounce Test', senderEmail: 'sender@leadflow-demo.test', sequenceId: sequenceRes.body.sequence.id });
    await request(app).post(`/api/outreach/campaigns/${campaignRes.body.campaign.id}/contacts`).set(auth).send({ contactIds: [contactRes.body.contact.id] });
    const draftsRes = await request(app).get('/api/outreach/drafts').set(auth);
    await request(app).post(`/api/outreach/drafts/${draftsRes.body.drafts[0].id}/approve`).set(auth).send({});
    await request(app).post(`/api/outreach/campaigns/${campaignRes.body.campaign.id}/approve`).set(auth).send({});
    await request(app).post(`/api/outreach/campaigns/${campaignRes.body.campaign.id}/start`).set(auth).send({});

    const messagesRes = await request(app).get('/api/outreach/messages').set(auth);
    expect(messagesRes.body.messages[0].status).toBe('bounced');

    const suppressionsRes = await request(app).get('/api/outreach/suppressions').set(auth);
    expect(suppressionsRes.body.suppressions.some((s: any) => s.normalized_email === 'willbounce@bounce-demo.test' && s.reason === 'bounce')).toBe(true);
  });

  it('reports a genuine send rejection as failed (never as sent), and a retried tick reports it as failed again without creating a duplicate message', async () => {
    const owner = await signupOwner(app);
    const auth = { Authorization: `Bearer ${owner.token}` };

    await request(app).patch('/api/outreach/settings').set(auth).send({ defaultSenderEmail: 'sender@leadflow-demo.test' });
    const contactRes = await request(app).post('/api/outreach/contacts').set(auth).send({ email: 'willfail@fail-demo.test', contactName: 'Failure Case' });
    const sequenceRes = await request(app).post('/api/outreach/sequences').set(auth).send({ name: 'Seq', steps: [{ stepOrder: 1, delayDays: 0, subjectTemplate: 'hi' }] });
    const campaignRes = await request(app)
      .post('/api/outreach/campaigns')
      .set(auth)
      .send({ name: 'Failure Test', senderEmail: 'sender@leadflow-demo.test', sequenceId: sequenceRes.body.sequence.id });
    await request(app).post(`/api/outreach/campaigns/${campaignRes.body.campaign.id}/contacts`).set(auth).send({ contactIds: [contactRes.body.contact.id] });
    const draftsRes = await request(app).get('/api/outreach/drafts').set(auth);
    await request(app).post(`/api/outreach/drafts/${draftsRes.body.drafts[0].id}/approve`).set(auth).send({});
    await request(app).post(`/api/outreach/campaigns/${campaignRes.body.campaign.id}/approve`).set(auth).send({});

    const startRes = await request(app).post(`/api/outreach/campaigns/${campaignRes.body.campaign.id}/start`).set(auth).send({});
    expect(startRes.body.tickResult.failed).toBe(1);
    expect(startRes.body.tickResult.sent).toBe(0);

    const messagesAfterFirst = await request(app).get('/api/outreach/messages').set(auth);
    expect(messagesAfterFirst.body.messages).toHaveLength(1);
    expect(messagesAfterFirst.body.messages[0].status).toBe('failed');

    // The failed contact must have moved out of 'approved', so a later tick
    // finds no eligible work for it at all — it must never be rediscovered
    // and silently retried or double-counted.
    const secondTick = await request(app).post('/api/outreach/tick').set(auth).send({});
    expect(secondTick.body.result.failed).toBe(0);
    expect(secondTick.body.result.sent).toBe(0);

    const messagesAfterSecond = await request(app).get('/api/outreach/messages').set(auth);
    expect(messagesAfterSecond.body.messages).toHaveLength(1);

    const campaignDetail = await request(app).get(`/api/outreach/campaigns/${campaignRes.body.campaign.id}`).set(auth);
    expect(campaignDetail.body.contacts[0].status).toBe('failed');
  });

  it('blocks sales users from approving campaigns or drafts (owner-only actions)', async () => {
    const owner = await signupOwner(app);
    const salesCreateRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Sales Rep', email: `outreachsales${Date.now()}@test.com`, password: 'password123', role: 'sales' });
    const loginRes = await request(app).post('/api/auth/login').send({ email: salesCreateRes.body.user.email, password: 'password123' });

    const res = await request(app)
      .post('/api/outreach/campaigns')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({ name: 'Should fail' });
    expect(res.status).toBe(403);
  });

  it('auto-pilot: importing with no campaign specified creates a campaign and sequence automatically, drafts immediately, and sends the instant a draft is approved', async () => {
    const owner = await signupOwner(app);
    const auth = { Authorization: `Bearer ${owner.token}` };

    await request(app).patch('/api/outreach/settings').set(auth).send({ defaultSenderEmail: 'autopilot@leadflow-demo.test' });

    // No campaignId, no skipAutoCampaign — this is the default "just import" action.
    const importRes = await request(app).post('/api/outreach/imports').set(auth).send({});
    expect(importRes.status).toBe(201);
    expect(importRes.body.campaign).toBeTruthy();
    expect(importRes.body.campaign.status).toBe('running');
    expect(importRes.body.campaign.sequence_id).toBeTruthy();
    expect(importRes.body.campaignResult.added).toBe(importRes.body.import.imported_rows);
    expect(importRes.body.campaignResult.draftsGenerated).toBe(importRes.body.import.imported_rows);

    // Drafts exist with zero manual sequence/campaign setup.
    const draftsRes = await request(app).get(`/api/outreach/drafts?campaignId=${importRes.body.campaign.id}`).set(auth);
    expect(draftsRes.body.drafts.length).toBe(importRes.body.import.imported_rows);

    // Nothing has sent yet — per-draft approval is still the human gate.
    const messagesBeforeApproval = await request(app).get('/api/outreach/messages').set(auth);
    expect(messagesBeforeApproval.body.messages).toHaveLength(0);

    // Approving one draft sends it immediately — no "approve campaign" or "start campaign" step at all.
    const draft = draftsRes.body.drafts[0];
    const approveRes = await request(app).post(`/api/outreach/drafts/${draft.id}/approve`).set(auth).send({});
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.sendOutcome).toBe('sent');
    expect(approveRes.body.draft.status).toBe('sent');

    const messagesAfterApproval = await request(app).get('/api/outreach/messages').set(auth);
    expect(messagesAfterApproval.body.messages).toHaveLength(1);
    expect(messagesAfterApproval.body.messages[0].status).toBe('delivered');
  });

  it('auto-pilot: repeated imports from the same saved sheet connection keep feeding the same campaign, not a new one each time', async () => {
    const owner = await signupOwner(app);
    const auth = { Authorization: `Bearer ${owner.token}` };

    await request(app).patch('/api/outreach/settings').set(auth).send({ defaultSenderEmail: 'autopilot2@leadflow-demo.test' });
    await request(app).post('/api/integrations/google-sheets').set(auth).send({ name: 'My Leads Sheet' });

    const firstImportRes = await request(app).post('/api/outreach/imports').set(auth).send({});
    expect(firstImportRes.body.campaign).toBeTruthy();
    const campaignId = firstImportRes.body.campaign.id;

    const secondImportRes = await request(app).post('/api/outreach/imports').set(auth).send({});
    expect(secondImportRes.body.campaign.id).toBe(campaignId);
    // Same mock dataset re-imported — every contact already exists in this campaign, so nothing new to add or draft.
    expect(secondImportRes.body.campaignResult.added).toBe(0);
    expect(secondImportRes.body.campaignResult.draftsGenerated).toBe(0);
  });

  it('every sheet import also creates a real CRM lead per contact (not just an outreach contact), and re-importing never duplicates them', async () => {
    const owner = await signupOwner(app);
    const auth = { Authorization: `Bearer ${owner.token}` };

    const importRes = await request(app).post('/api/outreach/imports').set(auth).send({ skipAutoCampaign: true });
    expect(importRes.status).toBe(201);
    expect(importRes.body.import.imported_rows).toBeGreaterThan(0);

    const leadsRes = await request(app).get('/api/leads?search=Dana').set(auth);
    expect(leadsRes.body.leads).toHaveLength(1);
    const lead = leadsRes.body.leads[0];
    expect(lead.email).toBe('dana@brightleafroasters.test');
    expect(lead.source).toBe('GoogleSheet');
    expect(lead.company).toBeTruthy();

    // Re-importing the same (unchanged) mock dataset must not create a second lead for the same contact.
    const secondImportRes = await request(app).post('/api/outreach/imports').set(auth).send({ skipAutoCampaign: true });
    expect(secondImportRes.body.import.duplicate_rows).toBeGreaterThan(0);

    const leadsAfterSecondImport = await request(app).get('/api/leads?search=Dana').set(auth);
    expect(leadsAfterSecondImport.body.leads).toHaveLength(1);
    expect(leadsAfterSecondImport.body.leads[0].id).toBe(lead.id);

    // The full import brings in several contacts — every one should have produced a lead.
    const allLeadsRes = await request(app).get('/api/leads?source=GoogleSheet&pageSize=50').set(auth);
    expect(allLeadsRes.body.leads.length).toBe(importRes.body.import.imported_rows);
  });

  it('imports straight into a campaign: sheet contacts are added and drafted in one action, with no duplicates on re-import', async () => {
    const owner = await signupOwner(app);
    const auth = { Authorization: `Bearer ${owner.token}` };

    await request(app).patch('/api/outreach/settings').set(auth).send({ defaultSenderEmail: 'sender@leadflow-demo.test' });
    const sequenceRes = await request(app).post('/api/outreach/sequences').set(auth).send({ name: 'Seq', steps: [{ stepOrder: 1, delayDays: 0, subjectTemplate: 'hi' }] });
    const campaignRes = await request(app)
      .post('/api/outreach/campaigns')
      .set(auth)
      .send({ name: 'Import Into Campaign', senderEmail: 'sender@leadflow-demo.test', sequenceId: sequenceRes.body.sequence.id });
    const campaignId = campaignRes.body.campaign.id;

    const importRes = await request(app).post('/api/outreach/imports').set(auth).send({ campaignId });
    expect(importRes.status).toBe(201);
    expect(importRes.body.import.imported_rows).toBeGreaterThan(0);
    expect(importRes.body.campaignResult.added).toBe(importRes.body.import.imported_rows);
    expect(importRes.body.campaignResult.draftsGenerated).toBe(importRes.body.import.imported_rows);

    const draftsRes = await request(app).get(`/api/outreach/drafts?campaignId=${campaignId}`).set(auth);
    expect(draftsRes.body.drafts.length).toBe(importRes.body.import.imported_rows);

    // Re-importing into the same campaign must not add duplicate campaign_contacts or drafts.
    const secondImportRes = await request(app).post('/api/outreach/imports').set(auth).send({ campaignId });
    expect(secondImportRes.body.campaignResult.added).toBe(0);
    expect(secondImportRes.body.campaignResult.draftsGenerated).toBe(0);

    const draftsAfterSecond = await request(app).get(`/api/outreach/drafts?campaignId=${campaignId}`).set(auth);
    expect(draftsAfterSecond.body.drafts.length).toBe(draftsRes.body.drafts.length);
  });

  it('deletes a contact, a sequence, and a campaign (and refuses to delete a sequence in active use)', async () => {
    const owner = await signupOwner(app);
    const auth = { Authorization: `Bearer ${owner.token}` };

    const contactRes = await request(app).post('/api/outreach/contacts').set(auth).send({ email: 'deleteme@leadflow-demo.test', contactName: 'Delete Me' });
    const deleteContactRes = await request(app).delete(`/api/outreach/contacts/${contactRes.body.contact.id}`).set(auth);
    expect(deleteContactRes.status).toBe(204);
    const contactsAfterDelete = await request(app).get('/api/outreach/contacts?search=deleteme').set(auth);
    expect(contactsAfterDelete.body.contacts).toHaveLength(0);

    const sequenceRes = await request(app).post('/api/outreach/sequences').set(auth).send({ name: 'Deletable Seq', steps: [{ stepOrder: 1, delayDays: 0, subjectTemplate: 'hi' }] });
    const campaignRes = await request(app)
      .post('/api/outreach/campaigns')
      .set(auth)
      .send({ name: 'Deletable Campaign', sequenceId: sequenceRes.body.sequence.id });

    // A sequence in use by an active (non-cancelled/completed) campaign cannot be deleted.
    const blockedDeleteRes = await request(app).delete(`/api/outreach/sequences/${sequenceRes.body.sequence.id}`).set(auth);
    expect(blockedDeleteRes.status).toBe(400);

    const deleteCampaignRes = await request(app).delete(`/api/outreach/campaigns/${campaignRes.body.campaign.id}`).set(auth);
    expect(deleteCampaignRes.status).toBe(204);

    // Now that no active campaign references it, the sequence can be deleted.
    const deleteSequenceRes = await request(app).delete(`/api/outreach/sequences/${sequenceRes.body.sequence.id}`).set(auth);
    expect(deleteSequenceRes.status).toBe(204);

    const campaignsRes = await request(app).get('/api/outreach/campaigns').set(auth);
    expect(campaignsRes.body.campaigns.find((c: any) => c.id === campaignRes.body.campaign.id)).toBeUndefined();
  });
});
