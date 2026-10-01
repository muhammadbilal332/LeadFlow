import React, { useEffect, useState } from 'react';
import { Mail, Sparkles, Sheet, Inbox as InboxIcon } from 'lucide-react';
import * as developerApi from '../../services/developerApi';
import { OutreachProvidersOverview } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';

const ROWS: Array<{ key: keyof OutreachProvidersOverview; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'ai', label: 'AI', icon: Sparkles },
  { key: 'sheets', label: 'Sheets', icon: Sheet },
  { key: 'inbound', label: 'Inbound', icon: InboxIcon },
];

function displayName(name: string): string {
  if (name === 'mock') return 'Mock';
  if (name === 'openai') return 'OpenAI';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export default function DeveloperProvidersPage(): React.ReactElement {
  const [providers, setProviders] = useState<OutreachProvidersOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await developerApi.getProviders();
      setProviders(res.providers);
    } catch {
      setError('Unable to load provider status.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingSpinner label="Loading provider status..." />;
  if (error || !providers) return <ErrorState message={error ?? 'Unknown error'} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-heading">Provider status</h1>
        <p className="mt-1 text-sm text-slate-500">Which integration is active for each capability. API keys are never displayed.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {ROWS.map((row) => {
          const p = providers[row.key];
          return (
            <div key={row.key} className="card p-5">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-slate-100 p-2 text-slate-500"><row.icon className="h-4 w-4" /></div>
                <h2 className="text-sm font-semibold text-slate-900">{row.label}</h2>
              </div>
              <p className="mt-3 text-lg font-bold text-slate-900">{displayName(p.name)}</p>
              <span className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${p.configured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {p.configured ? 'Configured' : 'Not configured'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
