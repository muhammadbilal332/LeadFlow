import React from 'react';
import { SlaState } from '../types';

const STYLES: Record<SlaState, string> = {
  Pending: 'bg-slate-100 text-slate-600',
  DueSoon: 'bg-amber-100 text-amber-700',
  Overdue: 'bg-red-100 text-red-700',
  Met: 'bg-emerald-100 text-emerald-700',
  Missed: 'bg-red-100 text-red-700',
};

const LABELS: Record<SlaState, string> = {
  Pending: 'Due',
  DueSoon: 'Due soon',
  Overdue: 'Overdue',
  Met: 'SLA met',
  Missed: 'SLA missed',
};

function formatCountdown(dueAt: string): string {
  const diffMs = new Date(dueAt).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const minutes = Math.round(abs / 60000);
  if (minutes < 60) return diffMs >= 0 ? `${minutes}m left` : `${minutes}m overdue`;
  const hours = Math.round(minutes / 60);
  return diffMs >= 0 ? `${hours}h left` : `${hours}h overdue`;
}

export default function SlaBadge({ state, dueAt }: { state: SlaState; dueAt: string | null }): React.ReactElement {
  const showCountdown = (state === 'Pending' || state === 'DueSoon' || state === 'Overdue') && dueAt;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[state]}`}>
      {LABELS[state]}
      {showCountdown && <span className="opacity-75">&middot; {formatCountdown(dueAt)}</span>}
    </span>
  );
}
