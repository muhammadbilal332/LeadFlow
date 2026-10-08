import React from 'react';
import { LeadStatus } from '../types';

const STATUS_STYLES: Record<LeadStatus, string> = {
  New: 'bg-slate-100 text-slate-700',
  Contacted: 'bg-blue-100 text-blue-700',
  Replied: 'bg-teal-100 text-teal-700',
  Qualified: 'bg-indigo-100 text-indigo-700',
  Proposal: 'bg-amber-100 text-amber-700',
  Negotiation: 'bg-orange-100 text-orange-700',
  Won: 'bg-emerald-100 text-emerald-700',
  Lost: 'bg-red-100 text-red-700',
};

export default function StatusBadge({ status }: { status: LeadStatus }): React.ReactElement {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700'}`}>
      {status}
    </span>
  );
}
