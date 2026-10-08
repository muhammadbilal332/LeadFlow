/**
 * Keeps a CRM lead's status in sync with its linked outreach_contact's real
 * email activity. Both transitions only ever move a lead *forward* out of
 * New/Contacted — a lead a human has already pushed into Qualified,
 * Proposal, Negotiation, Won, or Lost is never overwritten, since that
 * reflects real pipeline progress the automatic reply/send detection
 * shouldn't clobber.
 */
import * as leadRepo from '../repositories/leadRepo';
import * as activityRepo from '../repositories/activityRepo';

/** New -> Contacted, called right after a lead's linked contact's first outbound email is confirmed sent. */
export async function markLeadContacted(businessId: string, leadId: string): Promise<void> {
  const lead = await leadRepo.findLeadById(leadId, businessId);
  if (!lead || lead.status !== 'New') return;

  await leadRepo.updateLead(leadId, businessId, { status: 'Contacted' });
  await activityRepo.createActivity({
    businessId,
    leadId,
    userId: null,
    type: 'Status changed',
    description: 'Status changed from New to Contacted (outreach email sent).',
  });
}

/** New/Contacted -> Replied, called right after a genuine inbound reply is detected for a lead's linked contact. */
export async function markLeadReplied(businessId: string, leadId: string): Promise<void> {
  const lead = await leadRepo.findLeadById(leadId, businessId);
  if (!lead || (lead.status !== 'New' && lead.status !== 'Contacted')) return;

  await leadRepo.updateLead(leadId, businessId, { status: 'Replied' });
  await activityRepo.createActivity({
    businessId,
    leadId,
    userId: null,
    type: 'Status changed',
    description: `Status changed from ${lead.status} to Replied (inbound reply detected).`,
  });
}
