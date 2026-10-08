import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestDatabase } from './testDb';
import { createApp } from '../src/app';
import { signupOwner, createSalesUser } from './helpers';

describe('Outreach platform (mock providers, full pipeline)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  async function createLead(app: ReturnType<typeof createApp>, auth: Record<string, string>, overrides: Partial<{ name: string; email: string }> = {}) {
    const res = await request(app)
      .post('/api/leads')
      .set(auth)
      .send({ name: overrides.name ?? 'Dana Prospect', email: overrides.email ?? `dana${Date.now()}@leadflow-demo.test`, source: 'Website' });
    expect(res.status).toBe(201);
    return res.body.lead;
  }

  it('reports every provider as mock and configured by default', async () => {
    const owner = await signupOwner(app);
    const res = await request(app).get('/api/outreach/providers').set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.body.providers.email).toEqual({ name: 'mock', configured: true, selected: 'mock' });
    expect(res.body.providers.ai).toEqual({ name: 'mock', configured: true, selected: 'mock' });
    expect(res.body.providers.sheets).toEqual({ name: 'mock', configured: true, selected: 'mock' });
    expect(res.body.providers.inbound).toEqual({ name: 'mock', configured: true, selected: 'mock' });
  });

  it('runs the streamlined direct-lead outreach flow: lead -> AI compose -> approve -> auto-send -> status Contacted -> reply -> status Replied -> follow-up stops', async () => {
    const owner = await signupOwner(app);
    const auth = { Authorization: `Bearer ${owner.token}` };

    await request(app).patch('/api/outreach/settings').set(auth).send({ defaultSenderName: 'Alex from LeadFlow', defaultSenderEmail: 'alex@leadflow-demo.test', dailySendLimit: 50 });

    const lead = await createLead(app, auth, { name: 'Dana Prospect', email: 'dana@brightleafroasters.test' });
    expect(lead.status).toBe('New');

    // Compose generates (or returns) the step-1 AI draft, never sending anything yet.
    const composeRes = await request(app).get(`/api/leads/${lead.id}/compose-email`).set(auth);
    expect(composeRes.status).toBe(200);
    expect(composeRes.body.draft.subject).toBeTruthy();
    expect(composeRes.body.stepOrder).toBe(1);
    const draftId = composeRes.body.draft.id;

    const messagesBeforeApproval = await request(app).get('/api/outreach/messages').set(auth);
    expect(messagesBeforeApproval.body.messages).toHaveLength(0);

    // Approving sends immediately — the Direct Lead campaign is always running, so there's no separate "start" step.
    const approveRes = await request(app).post(`/api/outreach/drafts/${draftId}/approve`).set(auth).send({});
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.sendOutcome).toBe('sent');

    const messagesAfterSend = await request(app).get('/api/outreach/messages').set(auth);
    expect(messagesAfterSend.body.messages).toHaveLength(1);
    expect(messagesAfterSend.body.messages[0].status).toBe('delivered');

    // New -> Contacted happened automatically on successful send.
    const leadAfterSend = await request(app).get(`/api/leads/${lead.id}`).set(auth);
    expect(leadAfterSend.body.lead.status).toBe('Contacted');

    // A retried tick must not double-send (idempotency) — this is the endpoint the external scheduler calls on a schedule.
    const retryTick = await request(app).post('/api/outreach/tick').set(auth).send({});
    expect(retryTick.body.result.sent).toBe(0);
    const messagesAfterRetry = await request(app).get('/api/outreach/messages').set(auth);
    expect(messagesAfterRetry.body.messages).toHaveLength(1);

    // The follow-up queue must now show this lead due for its 3-day step.
    const queueRes = await request(app).get('/api/outreach/follow-up-queue').set(auth);
    const allQueued = Object.values(queueRes.body.queue).flat() as any[];
    expect(allQueued.some((item) => item.lead_id === lead.id)).toBe(false); // not due yet (3 days out)

    // An "interested" reply stops follow-ups and bumps status to Replied.
    const replyRes = await request(app)
      .post('/api/outreach/dev/simulate-reply')
      .set(auth)
      .send({ fromEmail: 'dana@brightleafroasters.test', body: 'Thanks for reaching out — sounds interesting, tell me more!' });
    expect(replyRes.status).toBe(201);
    expect(replyRes.body.result.classification).toBe('interested');
    expect(replyRes.body.result.leadCreated).toBe(false);

    const leadAfterReply = await request(app).get(`/api/leads/${lead.id}`).set(auth);
    expect(leadAfterReply.body.lead.status).toBe('Replied');

    // Because a reply was received, no follow-up draft is ever generated for this contact.
    const tickAfterReply = await request(app).post('/api/outreach/tick').set(auth).send({});
    expect(tickAfterReply.body.result.draftsGenerated).toBe(0);
  });

  it('blocks a send once a recipient is suppressed before the draft is approved', async () => {
    const owner = await signupOwner(app);
    const auth = { Authorization: `Bearer ${owner.token}` };
    await request(app).patch('/api/outreach/settings').set(auth).send({ defaultSenderEmail: 'sender@leadflow-demo.test' });

    const lead = await createLead(app, auth, { email: 'prospect@suppress-demo.test' });
    const composeRes = await request(app).get(`/api/leads/${lead.id}/compose-email`).set(auth);
    const draftId = composeRes.body.draft.id;

    // Suppress the recipient AFTER drafting but BEFORE approval.
    const suppressRes = await request(app).post('/api/outreach/suppressions').set(auth).send({ email: 'prospect@suppress-demo.test', reason: 'manual' });
    expect(suppressRes.status).toBe(201);

    const approveRes = await request(app).post(`/api/outreach/drafts/${draftId}/approve`).set(auth).send({});
    expect(approveRes.body.sendOutcome).toBe('blocked');

    const messagesRes = await request(app).get('/api/outreach/messages').set(auth);
    expect(messagesRes.body.messages).toHaveLength(0);
  });

  it('flags a draft as blocked when the recipient was already suppressed, and refuses to approve it', async () => {
    const owner = await signupOwner(app);
    const auth = { Authorization: `Bearer ${owner.token}` };
    await request(app).patch('/api/outreach/settings').set(auth).send({ defaultSenderEmail: 'sender@leadflow-demo.test' });
    await request(app).post('/api/outreach/suppressions').set(auth).send({ email: 'already-suppressed@leadflow-demo.test', reason: 'manual' });

    const lead = await createLead(app, auth, { email: 'already-suppressed@leadflow-demo.test' });
    const composeRes = await request(app).get(`/api/leads/${lead.id}/compose-email`).set(auth);
    const draft = composeRes.body.draft;
    expect(draft.quality_status).toBe('blocked');
    expect(draft.quality_issues.some((i: any) => i.code === 'suppressed_recipient')).toBe(true);

    const approveRes = await request(app).post(`/api/outreach/drafts/${draft.id}/approve`).set(auth).send({});
    expect(approveRes.status).toBe(400);
  });

  it('classifies an unsubscribe reply and permanently suppresses the contact', async () => {
    const owner = await signupOwner(app);
    const auth = { Authorization: `Bearer ${owner.token}` };
    await request(app).patch('/api/outreach/settings').set(auth).send({ defaultSenderEmail: 'sender@leadflow-demo.test' });

    const lead = await createLead(app, auth, { email: 'unsub2@leadflow-demo.test' });
    const composeRes = await request(app).get(`/api/leads/${lead.id}/compose-email`).set(auth);
    const approveRes = await request(app).post(`/api/outreach/drafts/${composeRes.body.draft.id}/approve`).set(auth).send({});
    expect(approveRes.body.sendOutcome).toBe('sent');

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

    const lead = await createLead(app, auth, { email: 'willbounce@bounce-demo.test' });
    const composeRes = await request(app).get(`/api/leads/${lead.id}/compose-email`).set(auth);
    await request(app).post(`/api/outreach/drafts/${composeRes.body.draft.id}/approve`).set(auth).send({});

    const messagesRes = await request(app).get('/api/outreach/messages').set(auth);
    expect(messagesRes.body.messages[0].status).toBe('bounced');

    const suppressionsRes = await request(app).get('/api/outreach/suppressions').set(auth);
    expect(suppressionsRes.body.suppressions.some((s: any) => s.normalized_email === 'willbounce@bounce-demo.test' && s.reason === 'bounce')).toBe(true);
  });

  it('reports a genuine send rejection as failed (never as sent), and a retried tick reports it as failed again without creating a duplicate message', async () => {
    const owner = await signupOwner(app);
    const auth = { Authorization: `Bearer ${owner.token}` };
    await request(app).patch('/api/outreach/settings').set(auth).send({ defaultSenderEmail: 'sender@leadflow-demo.test' });

    const lead = await createLead(app, auth, { email: 'willfail@fail-demo.test' });
    const composeRes = await request(app).get(`/api/leads/${lead.id}/compose-email`).set(auth);
    const approveRes = await request(app).post(`/api/outreach/drafts/${composeRes.body.draft.id}/approve`).set(auth).send({});
    expect(approveRes.body.sendOutcome).toBe('failed');

    const messagesAfterFirst = await request(app).get('/api/outreach/messages').set(auth);
    expect(messagesAfterFirst.body.messages).toHaveLength(1);
    expect(messagesAfterFirst.body.messages[0].status).toBe('failed');

    // The failed campaign_contact must have moved out of 'approved', so a
    // later tick finds no eligible work for it — never rediscovered or
    // silently retried / double-counted.
    const secondTick = await request(app).post('/api/outreach/tick').set(auth).send({});
    expect(secondTick.body.result.failed).toBe(0);
    expect(secondTick.body.result.sent).toBe(0);

    const messagesAfterSecond = await request(app).get('/api/outreach/messages').set(auth);
    expect(messagesAfterSecond.body.messages).toHaveLength(1);
  });

  it('blocks sales users from creating a sequence (owner-only action)', async () => {
    const owner = await signupOwner(app);
    const sales = await createSalesUser(app, owner.token);

    const res = await request(app)
      .post('/api/outreach/sequences')
      .set('Authorization', `Bearer ${sales.token}`)
      .send({ name: 'Should fail', steps: [{ stepOrder: 1, delayDays: 0, subjectTemplate: 'hi' }] });
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

  it('deletes a contact and a sequence not in active use', async () => {
    const owner = await signupOwner(app);
    const auth = { Authorization: `Bearer ${owner.token}` };

    const contactRes = await request(app).post('/api/outreach/contacts').set(auth).send({ email: 'deleteme@leadflow-demo.test', contactName: 'Delete Me' });
    const deleteContactRes = await request(app).delete(`/api/outreach/contacts/${contactRes.body.contact.id}`).set(auth);
    expect(deleteContactRes.status).toBe(204);
    const contactsAfterDelete = await request(app).get('/api/outreach/contacts?search=deleteme').set(auth);
    expect(contactsAfterDelete.body.contacts).toHaveLength(0);

    const sequenceRes = await request(app).post('/api/outreach/sequences').set(auth).send({ name: 'Deletable Seq', steps: [{ stepOrder: 1, delayDays: 0, subjectTemplate: 'hi' }] });
    const deleteSequenceRes = await request(app).delete(`/api/outreach/sequences/${sequenceRes.body.sequence.id}`).set(auth);
    expect(deleteSequenceRes.status).toBe(204);
  });
});
