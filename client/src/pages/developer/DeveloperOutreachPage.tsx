import React, { useEffect, useState } from 'react';
import { FileEdit, CheckCircle2, Clock, Send, Inbox, XOctagon, ShieldOff, MessageSquareReply, ArrowRight } from 'lucide-react';
import * as developerApi from '../../services/developerApi';
import { OutreachLifecycleStats, RecentCampaignSummary } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  review: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  running: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-orange-100 text-orange-700',
  completed: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-red-100 text-red-700',
};

const STAGES: Array<{ key: keyof OutreachLifecycleStats; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'draft', label: 'Draft', icon: FileEdit },
  { key: 'approved', label: 'Approved', icon: CheckCircle2 },
  { key: 'queued', label: 'Queued', icon: Clock },
  { key: 'sent', label: 'Sent', icon: Send },
  { key: 'delivered', label: 'Delivered', icon: Inbox },
  { key: 'failed', label: 'Failed', icon: XOctagon },
  { key: 'bounced', label: 'Bounced', icon: ShieldOff },
  { key: 'replied', label: 'Replied', icon: MessageSquareReply },
];

export default function DeveloperOutreachPage(): React.ReactElement {
  const [lifecycle, setLifecycle] = useState<OutreachLifecycleStats | null>(null);
  const [campaigns, setCampaigns] = useState<RecentCampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await developerApi.getOutreach();
      setLifecycle(res.lifecycle);
      setCampaigns(res.campaigns);
    } catch {
      setError('Unable to load outreach data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingSpinner label="Loading outreach data..." />;
  if (error || !lifecycle) return <ErrorState message={error ?? 'Unknown error'} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-heading">Outreach monitoring</h1>
        <p className="mt-1 text-sm text-slate-500">The full lifecycle, across every business: draft &rarr; approved &rarr; queued &rarr; sent &rarr; delivered/failed &rarr; reply.</p>
      </div>

      <div className="card overflow-x-auto p-5">
        <div className="flex min-w-max items-center gap-2">
          {STAGES.map((stage, i) => (
            <React.Fragment key={stage.key}>
              <div className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 px-4 py-3 text-center">
                <stage.icon className="h-4 w-4 text-slate-400" />
                <p className="text-xl font-bold text-slate-900">{lifecycle[stage.key]}</p>
                <p className="text-xs text-slate-500">{stage.label}</p>
              </div>
              {i < STAGES.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Recent campaigns</h2>
        </div>
        {campaigns.length === 0 ? (
          <EmptyState title="No campaigns yet" />
        ) : (
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Campaign</th>
                <th className="px-4 py-2">Business</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-2 text-slate-600">{c.business_name}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status] ?? 'bg-slate-100 text-slate-500'}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
