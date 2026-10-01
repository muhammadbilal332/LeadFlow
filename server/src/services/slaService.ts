export type SlaState = 'Pending' | 'DueSoon' | 'Overdue' | 'Met' | 'Missed';

const DUE_SOON_WINDOW_MS = 5 * 60 * 1000;

export function computeSlaState(lead: { sla_status: string; sla_due_at: string | null }): SlaState {
  if (lead.sla_status === 'Met') return 'Met';
  if (lead.sla_status === 'Missed') return 'Missed';
  if (!lead.sla_due_at) return 'Pending';

  const due = new Date(lead.sla_due_at).getTime();
  const now = Date.now();
  if (now > due) return 'Overdue';
  if (due - now <= DUE_SOON_WINDOW_MS) return 'DueSoon';
  return 'Pending';
}
