import React, { useEffect, useState } from 'react';
import * as developerApi from '../../services/developerApi';
import { HealthServices } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import StatusBadge from '../../components/developer/StatusBadge';

const ROWS: Array<{ key: keyof HealthServices; label: string }> = [
  { key: 'leadflowApi', label: 'SellerClutch API' },
  { key: 'database', label: 'Supabase / PostgreSQL' },
  { key: 'scheduler', label: 'Outreach scheduler' },
  { key: 'emailProvider', label: 'Email provider' },
  { key: 'aiProvider', label: 'AI provider' },
  { key: 'sheetsProvider', label: 'Google Sheets provider' },
  { key: 'inboundProvider', label: 'Inbound email provider' },
];

export default function DeveloperHealthPage(): React.ReactElement {
  const [services, setServices] = useState<HealthServices | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await developerApi.getHealth();
      setServices(res.services);
    } catch {
      setError('Unable to load system health.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingSpinner label="Checking system health..." />;
  if (error || !services) return <ErrorState message={error ?? 'Unknown error'} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-heading">API health</h1>
        <p className="mt-1 text-sm text-slate-500">Live status, checked just now. No credentials are ever shown here.</p>
      </div>

      <div className="card divide-y divide-slate-100">
        {ROWS.map((row) => {
          const service = services[row.key];
          const detail = 'detail' in service ? service.detail : undefined;
          return (
            <div key={row.key} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-medium text-slate-900">{row.label}</p>
                {detail && <p className="text-xs capitalize text-slate-500">{detail}</p>}
              </div>
              <StatusBadge status={service.status} />
            </div>
          );
        })}
      </div>

      <button className="btn-secondary" onClick={load}>Re-check now</button>
    </div>
  );
}
