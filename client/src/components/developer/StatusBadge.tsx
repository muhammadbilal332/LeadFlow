import React from 'react';
import { HealthStatus } from '../../types';

const STATUS_STYLES: Record<HealthStatus, string> = {
  healthy: 'bg-emerald-100 text-emerald-700',
  degraded: 'bg-amber-100 text-amber-700',
  unavailable: 'bg-red-100 text-red-700',
  not_configured: 'bg-slate-100 text-slate-500',
};

const STATUS_LABELS: Record<HealthStatus, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  unavailable: 'Unavailable',
  not_configured: 'Not configured',
};

export default function StatusBadge({ status }: { status: HealthStatus }): React.ReactElement {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}
