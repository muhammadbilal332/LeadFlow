import React, { useEffect, useState } from 'react';
import { Workflow, CheckCircle2, XCircle } from 'lucide-react';
import * as developerApi from '../../services/developerApi';
import { AutomationSummary, AutomationExecutionLog } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function DeveloperAutomationPage(): React.ReactElement {
  const [connected, setConnected] = useState(false);
  const [summary, setSummary] = useState<AutomationSummary | null>(null);
  const [recent, setRecent] = useState<AutomationExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await developerApi.getAutomationStatus();
      setConnected(res.connected);
      setSummary(res.summary);
      setRecent(res.recent);
    } catch {
      setError('Unable to load automation status.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingSpinner label="Loading automation status..." />;
  if (error || !summary) return <ErrorState message={error ?? 'Unknown error'} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-heading">Automation status</h1>
        <p className="mt-1 text-sm text-slate-500">
          LeadFlow does not depend on any particular scheduler to run — any HTTP-capable caller can advance the
          outreach queue. Status here is derived from real recorded executions of{' '}
          <code className="rounded bg-slate-100 px-1">POST /api/outreach/tick</code> authenticated with an API key —
          currently a GitHub Actions scheduled workflow — never assumed just because the route exists.
        </p>
      </div>

      <div className="card flex items-center gap-4 p-5">
        <span className={`rounded-full p-3 ${connected ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
          {connected ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
        </span>
        <div>
          <p className="text-lg font-bold text-slate-900">{connected ? 'SCHEDULER CONNECTED' : 'SCHEDULER NOT CONNECTED'}</p>
          <p className="text-sm text-slate-500">
            {connected ? `${summary.apiKeyExecutionsLast24h} API-key execution(s) in the last 24 hours.` : 'No API-key-authenticated execution recorded in the last 24 hours.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="eyebrow">Last run</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{relativeTime(summary.lastExecutionAt)}</p>
        </div>
        <div className="card p-5">
          <p className="eyebrow">Last successful run</p>
          <p className="mt-2 text-lg font-semibold text-emerald-700">{relativeTime(summary.lastSuccessAt)}</p>
        </div>
        <div className="card p-5">
          <p className="eyebrow">Last failure</p>
          <p className="mt-2 text-lg font-semibold text-red-700">{relativeTime(summary.lastFailureAt)}</p>
        </div>
      </div>

      <div className="card p-5">
        <p className="eyebrow">Total executions recorded</p>
        <p className="mt-2 text-2xl font-bold text-slate-900">{summary.totalExecutions}</p>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Execution history</h2>
        </div>
        {recent.length === 0 ? (
          <EmptyState icon={<Workflow className="h-6 w-6" />} title="No executions recorded yet" description="Runs from the external scheduler, or the manual 'Process queue' button, will show here." />
        ) : (
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">Triggered by</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Drafts</th>
                <th className="px-4 py-2">Sent</th>
                <th className="px-4 py-2">Failed</th>
                <th className="px-4 py-2">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-slate-600">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${r.triggered_by === 'api_key' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                      {r.triggered_by === 'api_key' ? 'Scheduler (API key)' : 'UI (manual)'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${r.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{r.drafts_generated}</td>
                  <td className="px-4 py-2 text-slate-600">{r.sent}</td>
                  <td className="px-4 py-2 text-slate-600">{r.failed}</td>
                  <td className="px-4 py-2 text-slate-500">{r.duration_ms ? `${r.duration_ms}ms` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
