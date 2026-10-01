import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, ArrowRight, Megaphone } from 'lucide-react';
import * as outreachApi from '../services/outreachApi';
import { OutreachProvidersOverview, OutreachCampaign } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import OutreachTabs from '../components/OutreachTabs';
import { useToast } from '../hooks/useToast';

export default function OutreachOverviewPage(): React.ReactElement {
  const { showToast } = useToast();
  const [providers, setProviders] = useState<OutreachProvidersOverview | null>(null);
  const [usage, setUsage] = useState<{ sentToday: number; sentThisMonth: number; failedThisMonth: number; bouncedThisMonth: number } | null>(null);
  const [dailyLimit, setDailyLimit] = useState(0);
  const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([]);
  const [pendingDraftCount, setPendingDraftCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ticking, setTicking] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [p, u, c, d] = await Promise.all([outreachApi.getProviders(), outreachApi.getUsage(), outreachApi.listCampaigns(), outreachApi.listDrafts()]);
      setProviders(p.providers);
      setUsage(u.usage);
      setDailyLimit(u.dailyLimit);
      setCampaigns(c.campaigns);
      setPendingDraftCount(d.drafts.length);
    } catch {
      setError('Unable to load outreach overview.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleTick() {
    setTicking(true);
    try {
      const res = await outreachApi.runTick();
      showToast(`Processed: ${res.result.draftsGenerated} draft(s) generated, ${res.result.sent} sent.`);
      load();
    } catch {
      showToast('Unable to process the outreach queue.', 'error');
    } finally {
      setTicking(false);
    }
  }

  if (loading) return <LoadingSpinner label="Loading outreach overview..." />;
  if (error || !providers || !usage) return <ErrorState message={error ?? 'Unknown error'} onRetry={load} />;

  const activeCampaigns = campaigns.filter((c) => !['completed', 'cancelled'].includes(c.status));

  return (
    <div className="space-y-4">
      <OutreachTabs />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-heading">Outreach</h1>
          <p className="mt-1 text-sm text-slate-500">Personalized cold email automation — every send is AI-drafted, reviewed by you, then sent.</p>
        </div>
        <button className="btn-primary" onClick={handleTick} disabled={ticking}>
          <Zap className="h-4 w-4" /> {ticking ? 'Processing...' : 'Process queue now'}
        </button>
      </div>

      {pendingDraftCount > 0 && (
        <Link to="/outreach/drafts" className="card-hover flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">{pendingDraftCount} draft{pendingDraftCount === 1 ? '' : 's'} awaiting your review</p>
            <p className="text-xs text-slate-500">Nothing sends until you approve it.</p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </Link>
      )}

      {activeCampaigns.length > 0 && (
        <div className="card p-5">
          <h2 className="eyebrow mb-3">Active campaigns</h2>
          <ul className="divide-y divide-slate-100">
            {activeCampaigns.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-slate-400" />
                  <span className="font-medium text-slate-900">{c.name}</span>
                  <span className="text-xs text-slate-400">&middot; {c.status}</span>
                </div>
                <Link to={`/outreach/campaigns/${c.id}`} className="text-brand-700 hover:underline">Open</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-900">Send usage ({providers.email.name} provider)</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Sent today</p>
            <p className="text-xl font-semibold text-slate-900">{usage.sentToday} <span className="text-sm font-normal text-slate-400">/ {dailyLimit}</span></p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Sent this month</p>
            <p className="text-xl font-semibold text-slate-900">{usage.sentThisMonth}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Failed this month</p>
            <p className="text-xl font-semibold text-slate-900">{usage.failedThisMonth}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Bounced this month</p>
            <p className="text-xl font-semibold text-slate-900">{usage.bouncedThisMonth}</p>
          </div>
        </div>
      </div>

      <div className="card p-5 text-sm text-slate-600">
        <p className="font-medium text-slate-900">How this works</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Import contacts (Contacts &rarr; a Google Sheet, or add one manually) — a campaign, sequence, and step-1 draft for each contact are created automatically. No manual setup needed.</li>
          <li>Review the drafts on the Drafts page and approve them. Nothing sends without your approval.</li>
          <li>Approving a draft sends it immediately — there's no separate "start campaign" step.</li>
          <li>Follow-up steps generate their own drafts as they come due; approve those the same way. <strong>Process queue now</strong> above (or an n8n schedule calling the same endpoint) catches any due follow-up drafts automatically without you checking in.</li>
          <li>Replies are detected and classified automatically, follow-ups stop, and genuine leads are added to your CRM — no manual step needed.</li>
          <li>Prefer full control instead? You can still build a Sequence and Campaign by hand from their tabs and add contacts to it directly — auto-pilot only kicks in when you import without picking a campaign.</li>
        </ol>
      </div>
    </div>
  );
}
