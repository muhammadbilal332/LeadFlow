import React from 'react';
import { Link } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: string;
  /** When given, the whole card links there — e.g. a lead-count KPI linking to that pre-filtered leads list. */
  to?: string;
}

export default function KpiCard({ label, value, icon: Icon, accent = 'text-brand-600 bg-brand-50', to }: KpiCardProps): React.ReactElement {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{label}</p>
        <div className={`shrink-0 rounded-lg p-2 ${accent}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-3 text-[1.75rem] font-bold leading-none tracking-tight text-slate-900 tabular-nums">{value}</p>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="card-hover animate-fade-in block p-5">
        {content}
      </Link>
    );
  }

  return <div className="card-hover animate-fade-in p-5">{content}</div>;
}
