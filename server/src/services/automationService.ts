import * as automationRepo from '../repositories/automationRuleRepo';
import { AutomationCondition, AutomationAction } from '../repositories/automationRuleRepo';
import * as leadRepo from '../repositories/leadRepo';
import * as activityRepo from '../repositories/activityRepo';
import * as followUpRepo from '../repositories/followUpRepo';
import { LeadRow } from '../repositories/leadRepo';
import { notifyUser, notifyOwner } from './notificationService';

function conditionMatches(condition: AutomationCondition, lead: LeadRow): boolean {
  if (condition.field === 'score') {
    const target = Number(condition.value);
    if (Number.isNaN(target)) return false;
    if (condition.operator === 'gte') return lead.score >= target;
    if (condition.operator === 'lte') return lead.score <= target;
    if (condition.operator === 'equals') return lead.score === target;
  }

  if (condition.field === 'source') {
    return condition.operator === 'equals' && lead.source.toLowerCase() === condition.value.toLowerCase();
  }

  if (condition.field === 'industry') {
    return condition.operator === 'equals' && (lead.industry ?? '').toLowerCase() === condition.value.toLowerCase();
  }

  return false;
}

async function runAction(businessId: string, lead: LeadRow, action: AutomationAction): Promise<void> {
  if (action.type === 'assign_user') {
    await leadRepo.updateLead(lead.id, businessId, { assignedUserId: action.userId });
    await notifyUser(businessId, action.userId, {
      type: 'lead_assigned',
      title: 'Lead assigned to you',
      message: `${lead.name} was assigned to you by an automation rule.`,
      link: `/leads/${lead.id}`,
    });
    return;
  }

  if (action.type === 'create_followup') {
    await followUpRepo.createFollowUp({
      businessId,
      leadId: lead.id,
      userId: lead.assigned_user_id,
      type: action.followUpType,
      scheduledAt: new Date(Date.now() + action.minutes * 60_000).toISOString(),
      notes: 'Automatically scheduled by an automation rule.',
    });
    return;
  }

  if (action.type === 'notify') {
    const payload = {
      type: 'automation',
      title: 'Automation notification',
      message: `Automation rule triggered for lead ${lead.name}.`,
      link: `/leads/${lead.id}`,
    };
    if (action.userId) {
      await notifyUser(businessId, action.userId, payload);
    } else {
      await notifyOwner(businessId, payload);
    }
  }
}

/** Runs a business's active "lead_created" automation rules against a newly-created lead. */
export async function runAutomationRules(businessId: string, lead: LeadRow, ctx: { actorUserId: string | null }): Promise<void> {
  const rules = await automationRepo.listActiveAutomationRules(businessId);

  for (const rule of rules) {
    const matches = rule.conditions.every((c) => conditionMatches(c, lead));
    if (!matches) continue;

    for (const action of rule.actions) {
      await runAction(businessId, lead, action);
    }

    await activityRepo.createActivity({
      businessId,
      leadId: lead.id,
      userId: ctx.actorUserId,
      type: 'Automation triggered',
      description: `Automation rule "${rule.name}" ran for this lead.`,
    });
  }
}
