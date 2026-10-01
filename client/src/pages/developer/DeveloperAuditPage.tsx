import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import * as developerApi from '../../services/developerApi';
import { DeveloperAuditLog } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';

export default function DeveloperAuditPage(): React.ReactElement {
  const [logs, setLogs] = useState<DeveloperAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await developerApi.getAuditLogs();
      setLogs(res.logs);
    } catch {
      setError('Unable to load audit logs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingSpinner label="Loading audit logs..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-heading">Audit logs</h1>
        <p className="mt-1 text-sm text-slate-500">Every sensitive developer action: who, what, on what, and when.</p>
      </div>

      <div className="card overflow-hidden">
        {logs.length === 0 ? (
          <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title="No audit entries yet" />
        ) : (
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">Actor</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Target</th>
                <th className="px-4 py-2">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2 text-slate-500">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2 text-slate-600">{l.actor_name ?? 'Unknown'}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{l.action.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2 text-slate-600">{l.target_type}{l.target_id ? ` (${l.target_id.slice(0, 8)}...)` : ''}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${l.result === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{l.result}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
