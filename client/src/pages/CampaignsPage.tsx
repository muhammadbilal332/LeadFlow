import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import * as campaignsApi from '../services/campaignsApi';
import { Campaign } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

function currency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export default function CampaignsPage(): React.ReactElement {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await campaignsApi.listCampaigns();
      setCampaigns(res.campaigns);
    } catch {
      setError('Unable to load campaigns.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Ad Campaigns</h1>
        <p className="text-sm text-slate-500">Leads grouped by marketing campaign (via UTM tracking). Separate from Outreach's own cold-email campaigns.</p>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading campaigns..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="h-6 w-6" />}
            title="No campaigns yet"
            description="Campaigns appear automatically once leads arrive with a utm_campaign parameter, from a form, webhook, or Meta ad."
          />
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Leads</th>
                <th className="px-4 py-3">Qualified</th>
                <th className="px-4 py-3">Won</th>
                <th className="px-4 py-3">Conversion</th>
                <th className="px-4 py-3">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaigns.map((c) => {
                const conversion = c.total_leads > 0 ? Math.round((c.won / c.total_leads) * 1000) / 10 : 0;
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <Link to={`/campaigns/${c.id}`} className="text-brand-700 hover:underline">{c.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.source ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{c.total_leads}</td>
                    <td className="px-4 py-3 text-slate-600">{c.qualified}</td>
                    <td className="px-4 py-3 text-emerald-600">{c.won}</td>
                    <td className="px-4 py-3 text-slate-600">{conversion}%</td>
                    <td className="px-4 py-3 text-slate-600">{c.revenue > 0 ? currency(c.revenue) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
