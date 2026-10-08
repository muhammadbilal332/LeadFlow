import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, ArrowRight } from 'lucide-react';
import * as outreachApi from '../services/outreachApi';
import { OutreachProvidersOverview } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import OutreachTabs from '../components/OutreachTabs';
import PageHeader from '../components/PageHeader';
import { useToast } from '../hooks/useToast';

export default function OutreachOverviewPage(): React.ReactElement {
  const { showToast } = useToast();
  const [providers, setProviders] = useState<OutreachProvidersOverview | null>(null);
  const [usage, setUsage] = useState<{ sentToday: number; sentThisMonth: number; failedThisMonth: number; bouncedThisMonth: number } | null>(null);
  const [dailyLimit, setDailyLimit] = useState(0);
  const [pendingDraftCount, setPendingDraftCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ticking, setTicking] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [p, u, d] = await Promise.all([outreachApi.getProviders(), outreachApi.getUsage(), outreachApi.listDrafts()]);
      setProviders(p.providers);
      setUsage(u.usage);
      setDailyLimit(u.dailyLimit);
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

  return (
    <div className="space-y-4">
      <OutreachTabs />
      <PageHeader
        eyebrow="Outreach"
        title="Outreach"
        description="Personalized cold email automation — every send is AI-drafted, reviewed by you, then sent."
        actions={
          <button className="btn-primary" onClick={handleTick} disabled={ticking}>
            <Zap className="h-4 w-4" /> {ticking ? 'Processing...' : 'Process queue now'}
          </button>
        }
      />

      {pendingDraftCount > 0 && (
        <Link to="/outreach/drafts" className="card-hover flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">{pendingDraftCount} draft{pendingDraftCount === 1 ? '' : 's'} awaiting your review</p>
            <p className="text-xs text-slate-500">Nothing sends until you approve it.</p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </Link>
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
    </div>
  );
}
