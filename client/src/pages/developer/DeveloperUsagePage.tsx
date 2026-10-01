import React, { useEffect, useState } from 'react';
import * as developerApi from '../../services/developerApi';
import { DeveloperUsage } from '../../services/developerApi';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';

export default function DeveloperUsagePage(): React.ReactElement {
  const [usage, setUsage] = useState<DeveloperUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await developerApi.getUsage();
      setUsage(res);
    } catch {
      setError('Unable to load usage data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingSpinner label="Loading usage..." />;
  if (error || !usage) return <ErrorState message={error ?? 'Unknown error'} onRetry={load} />;

  const monthlyPct = Math.min(100, Math.round((usage.monthly.sent / usage.plannedMonthlyLimit) * 100));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-heading">Usage</h1>
        <p className="mt-1 text-sm text-slate-500">Platform-wide totals for the active provider ({usage.provider}).</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="eyebrow">Sent today</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{usage.daily.sent}</p>
        </div>
        <div className="card p-5">
          <p className="eyebrow">Failed today</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{usage.daily.failed}</p>
        </div>
        <div className="card p-5">
          <p className="eyebrow">Bounced today</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{usage.daily.bounced}</p>
        </div>
        <div className="card p-5">
          <p className="eyebrow">Sent this month</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{usage.monthly.sent}</p>
        </div>
        <div className="card p-5">
          <p className="eyebrow">AI generations (total)</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{usage.aiGenerationsTotal}</p>
        </div>
        <div className="card p-5">
          <p className="eyebrow">n8n executions (total)</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{usage.n8nExecutionsTotal}</p>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Monthly send volume (planned limit)</h2>
          <span className="text-sm text-slate-500">{usage.monthly.sent.toLocaleString()} / {usage.plannedMonthlyLimit.toLocaleString()}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-600" style={{ width: `${monthlyPct}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          This limit ({usage.plannedMonthlyLimit.toLocaleString()}/month) is not currently enforced — it's shown so the architecture is ready for it. Each business's own daily cap is {usage.dailyLimitPerBusiness} emails/day, configurable per business in Settings → Integrations.
        </p>
      </div>
    </div>
  );
}
