import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import * as campaignsApi from '../services/campaignsApi';
import { Lead } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import ScoreBadge from '../components/ScoreBadge';

export default function CampaignDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<{ id: string; name: string; source: string | null; utm_campaign: string | null } | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await campaignsApi.getCampaign(id);
      setCampaign(res.campaign);
      setLeads(res.leads);
    } catch {
      setError('Unable to load this campaign.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  if (loading) return <LoadingSpinner label="Loading campaign..." />;
  if (error || !campaign) return <ErrorState message={error ?? 'Unknown error'} onRetry={load} />;

  return (
    <div className="space-y-4">
      <Link to="/campaigns" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to campaigns
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{campaign.name}</h1>
        <p className="text-sm text-slate-500">
          {campaign.source && <>Source: {campaign.source} &middot; </>}
          utm_campaign: {campaign.utm_campaign ?? '—'} &middot; {leads.length} lead{leads.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="card overflow-hidden">
        {leads.length === 0 ? (
          <EmptyState title="No leads yet" description="Leads with a matching utm_campaign will appear here." />
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="px-4 py-3">
                    <Link to={`/leads/${lead.id}`} className="font-medium text-brand-700 hover:underline">{lead.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{lead.company || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                  <td className="px-4 py-3"><ScoreBadge score={lead.score} /></td>
                  <td className="px-4 py-3 text-slate-500">{new Date(lead.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
