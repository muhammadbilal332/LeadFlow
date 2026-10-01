import React, { useEffect, useState } from 'react';
import { ScrollText, AlertTriangle, Info, XCircle } from 'lucide-react';
import * as developerApi from '../../services/developerApi';
import { SystemEvent } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';

const SEVERITY_STYLES: Record<string, { color: string; icon: React.ComponentType<{ className?: string }> }> = {
  info: { color: 'bg-blue-100 text-blue-700', icon: Info },
  warning: { color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  error: { color: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function DeveloperLogsPage(): React.ReactElement {
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [severity, setSeverity] = useState<'info' | 'warning' | 'error' | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await developerApi.getLogs(severity || undefined);
      setEvents(res.events);
    } catch {
      setError('Unable to load system logs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [severity]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-heading">System logs</h1>
          <p className="mt-1 text-sm text-slate-500">Authentication failures, API errors, and other operational events. Never includes passwords, keys, or tokens.</p>
        </div>
        <select className="input sm:w-48" value={severity} onChange={(e) => setSeverity(e.target.value as any)}>
          <option value="">All severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading logs..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <div className="card overflow-hidden">
          {events.length === 0 ? (
            <EmptyState icon={<ScrollText className="h-6 w-6" />} title="No events logged" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {events.map((e) => {
                const style = SEVERITY_STYLES[e.severity] ?? SEVERITY_STYLES.info;
                const Icon = style.icon;
                return (
                  <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                    <span className={`mt-0.5 rounded-full p-1.5 ${style.color}`}><Icon className="h-3.5 w-3.5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase text-slate-500">{e.event_type.replace(/_/g, ' ')}</span>
                        {e.business_name && <span className="text-xs text-slate-400">&middot; {e.business_name}</span>}
                        <span className="text-xs text-slate-400">&middot; {new Date(e.created_at).toLocaleString()}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-slate-700">{e.message}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
