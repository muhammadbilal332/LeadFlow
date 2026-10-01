/**
 * Fully automatic path from "sheet import" to "ready to send": when an
 * import isn't explicitly pointed at a campaign, this creates (or reuses) a
 * dedicated campaign and a single-step sequence, and puts the campaign
 * straight into 'running' status — skipping the manual
 * review/approve-campaign/start steps entirely. The only human checkpoint
 * left is the existing per-draft approval gate in outreachDraftController,
 * which (via outreachQueueService.sendOneApprovedDraft) now sends the
 * moment that approval happens.
 */
import * as outreachCampaignRepo from '../../repositories/outreachCampaignRepo';
import * as outreachSequenceRepo from '../../repositories/outreachSequenceRepo';
import * as sheetRepo from '../../repositories/sheetRepo';
import { logAudit } from '../../repositories/outreachAuditLogRepo';
import { SheetConnectionRow } from '../../repositories/sheetRepo';
import { OutreachCampaignRow } from '../../repositories/outreachCampaignRepo';

const ACTIVE_STATUSES = new Set(['draft', 'review', 'approved', 'running', 'paused']);

/**
 * Returns the connection's existing auto-pilot campaign if it's still
 * active, otherwise creates a new sequence + campaign, sets the campaign
 * running immediately, and (when a saved connection exists) remembers it
 * for next time. Without a saved connection (the mock demo dataset with no
 * Google Sheet configured), there's nowhere to remember the mapping, so
 * each import gets its own fresh campaign — a reasonable fallback since
 * there's no stable identity to key off.
 */
export async function getOrCreateAutoPilotCampaign(
  businessId: string,
  connection: SheetConnectionRow | null,
  createdBy: string | null
): Promise<OutreachCampaignRow> {
  if (connection?.default_campaign_id) {
    const existing = await outreachCampaignRepo.findCampaignById(connection.default_campaign_id, businessId);
    if (existing && ACTIVE_STATUSES.has(existing.status)) {
      // A campaign the user deliberately paused stays paused — auto-pilot
      // still adds and drafts contacts into it, but respects that a human
      // chose to stop sending, rather than silently resuming it.
      if (['draft', 'review', 'approved'].includes(existing.status)) {
        return (await outreachCampaignRepo.setStatus(existing.id, businessId, 'running')) ?? existing;
      }
      return existing;
    }
  }

  const label = connection?.name || 'Sheet import';
  const dateStamp = new Date().toISOString().slice(0, 10);

  const sequence = await outreachSequenceRepo.createSequence({
    businessId,
    name: `${label} — auto sequence`,
    description: 'Created automatically by sheet-import auto-pilot.',
  });
  await outreachSequenceRepo.replaceSteps(sequence.id, [
    { stepOrder: 1, delayDays: 0, subjectTemplate: 'Quick question about {{company}}', aiPersonalize: true, isEnabled: true },
  ]);

  const campaign = await outreachCampaignRepo.createCampaign({
    businessId,
    name: `${label} — ${dateStamp}`,
    description: 'Created automatically by sheet-import auto-pilot. Review and approve each draft to send it.',
    sequenceId: sequence.id,
    createdBy,
  });
  const running = (await outreachCampaignRepo.setStatus(campaign.id, businessId, 'running')) ?? campaign;

  if (connection) {
    await sheetRepo.setDefaultCampaign(connection.id, campaign.id);
  }

  await logAudit({
    businessId,
    actorUserId: createdBy,
    action: 'auto_pilot_campaign_created',
    entityType: 'outreach_campaign',
    entityId: campaign.id,
    metadata: { sequenceId: sequence.id, connectionId: connection?.id ?? null },
  });

  return running;
}
