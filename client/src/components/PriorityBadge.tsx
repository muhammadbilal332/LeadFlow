import React from 'react';
import { LeadPriority } from '../types';

const STYLES: Record<LeadPriority, string> = {
  Low: 'bg-sky-100 text-sky-700',
  Medium: 'bg-amber-100 text-amber-700',
  High: 'bg-orange-100 text-orange-700',
  Hot: 'bg-red-100 text-red-700',
};

export default function PriorityBadge({ priority, score }: { priority: LeadPriority; score?: number }): React.ReactElement {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[priority]}`} title="Lead Score priority">
      {priority}
      {score !== undefined && <span className="opacity-70">&middot; {score}</span>}
    </span>
  );
}
