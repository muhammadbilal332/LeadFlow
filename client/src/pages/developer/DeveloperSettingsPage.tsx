import React, { useEffect, useState } from 'react';
import * as developerApi from '../../services/developerApi';
import { HealthServices, OutreachProvidersOverview } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';

export default function DeveloperSettingsPage(): React.ReactElement {
  const [health, setHealth] = useState<HealthServices | null>(null);
  const [providers, setProviders] = useState<OutreachProvidersOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [h, p] = await Promise.all([developerApi.getHealth(), developerApi.getProviders()]);
      setHealth(h.services);
      setProviders(p.providers);
    } catch {
      setError('Unable to load configuration status.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingSpinner label="Loading settings..." />;
  if (error || !health || !providers) return <ErrorState message={error ?? 'Unknown error'} onRetry={load} />;

  const providerLabel = (name: string) => (name === 'mock' ? 'Mock' : name === 'openai' ? 'OpenAI' : name.charAt(0).toUpperCase() + name.slice(1));

  const rows = [
    { label: 'Database', value: health.database.status === 'healthy' ? 'Connected' : 'Unavailable' },
    { label: 'Email provider', value: providerLabel(providers.email.name) },
    { label: 'AI provider', value: providerLabel(providers.ai.name) },
    { label: 'Sheets provider', value: providerLabel(providers.sheets.name) },
    { label: 'Inbound provider', value: providerLabel(providers.inbound.name) },
    { label: 'n8n', value: health.n8n.status === 'healthy' ? 'Connected' : health.n8n.status === 'degraded' ? 'Degraded' : 'Not connected' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-heading">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Configuration status only — no secrets, keys, or connection strings are ever shown here, even partially.</p>
      </div>

      <div className="card divide-y divide-slate-100">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between px-5 py-4">
            <p className="text-sm font-medium text-slate-900">{row.label}</p>
            <p className="text-sm text-slate-600">{row.value}</p>
          </div>
        ))}
      </div>

      <div className="card p-5 text-sm text-slate-600">
        <p className="font-medium text-slate-900">How the developer account is provisioned</p>
        <p className="mt-2">
          Set <code className="rounded bg-slate-100 px-1">DEVELOPER_EMAIL</code> and <code className="rounded bg-slate-100 px-1">DEVELOPER_PASSWORD</code> in
          the server's <code className="rounded bg-slate-100 px-1">.env</code>. On the next server start, that account is created once (idempotently — restarts never touch it again). See{' '}
          <code className="rounded bg-slate-100 px-1">docs/DEVELOPER_DASHBOARD.md</code>.
        </p>
      </div>
    </div>
  );
}
