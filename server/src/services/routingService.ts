import * as routingRepo from '../repositories/routingRuleRepo';
import * as userRepo from '../repositories/userRepo';
import { RoutingRuleRow } from '../repositories/routingRuleRepo';

export interface AssignmentContext {
  source: string;
  industry?: string | null;
  score: number;
}

function ruleMatches(rule: RoutingRuleRow, ctx: AssignmentContext): boolean {
  if (rule.field === 'always') return true;

  if (rule.field === 'source') {
    return rule.operator === 'equals' && ctx.source.toLowerCase() === (rule.value ?? '').toLowerCase();
  }

  if (rule.field === 'industry') {
    return rule.operator === 'equals' && (ctx.industry ?? '').toLowerCase() === (rule.value ?? '').toLowerCase();
  }

  if (rule.field === 'score') {
    const target = Number(rule.value);
    if (Number.isNaN(target)) return false;
    if (rule.operator === 'gte') return ctx.score >= target;
    if (rule.operator === 'lte') return ctx.score <= target;
  }

  return false;
}

/** Runs the business's active routing rules (in priority order) against a lead and returns who it should be assigned to, or null if nothing matches. */
export async function resolveAssignment(businessId: string, ctx: AssignmentContext): Promise<string | null> {
  const rules = await routingRepo.listActiveRoutingRules(businessId);

  for (const rule of rules) {
    if (!ruleMatches(rule, ctx)) continue;

    if (rule.assignment_type === 'user') {
      return rule.assign_user_id;
    }
    if (rule.assignment_type === 'round_robin') {
      return routingRepo.getNextRoundRobinUser(businessId);
    }
    if (rule.assignment_type === 'owner') {
      const owner = await userRepo.findOwnerByBusiness(businessId);
      return owner?.id ?? null;
    }
  }

  return null;
}
