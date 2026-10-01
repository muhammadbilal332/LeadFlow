import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Megaphone, Trash2 } from 'lucide-react';
import * as outreachApi from '../services/outreachApi';
import { OutreachCampaign, OutreachSequence } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import OutreachTabs from '../components/OutreachTabs';
import { useToast } from '../hooks/useToast';
import { isLikelyPersonalEmailDomain } from '../lib/outreachErrors';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  review: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  running: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-orange-100 text-orange-700',
  completed: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-red-100 text-red-700',
};

export default function OutreachCampaignsPage(): React.ReactElement {
  const { showToast } = useToast();
  const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([]);
  const [sequences, setSequences] = useState<OutreachSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', senderName: '', senderEmail: '', sequenceId: '' });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OutreachCampaign | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [c, s] = await Promise.all([outreachApi.listCampaigns(), outreachApi.listSequences()]);
      setCampaigns(c.campaigns);
      setSequences(s.sequences);
    } catch {
      setError('Unable to load campaigns.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await outreachApi.createCampaign({
        name: form.name,
        senderName: form.senderName || null,
        senderEmail: form.senderEmail || null,
        sequenceId: form.sequenceId || null,
      });
      showToast('Campaign created.');
      setForm({ name: '', senderName: '', senderEmail: '', sequenceId: '' });
      setShowForm(false);
      load();
    } catch {
      showToast('Unable to create campaign.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await outreachApi.deleteCampaign(deleteTarget.id);
      showToast('Campaign deleted.');
      setDeleteTarget(null);
      load();
    } catch {
      showToast('Unable to delete campaign.', 'error');
    }
  }

  if (loading) return <LoadingSpinner label="Loading campaigns..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <OutreachTabs />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Outreach campaigns</h1>
          <p className="text-sm text-slate-500">Each campaign sends one sequence to a group of contacts, with human review before any email goes out.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> New campaign
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card grid gap-3 p-4 sm:grid-cols-2">
          <input className="input" placeholder="Campaign name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <select className="input" value={form.sequenceId} onChange={(e) => setForm({ ...form, sequenceId: e.target.value })} required>
            <option value="">Select a sequence *</option>
            {sequences.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input className="input" placeholder="Sender name" value={form.senderName} onChange={(e) => setForm({ ...form, senderName: e.target.value })} />
          <input className="input" placeholder="Sender email (defaults to your outreach settings)" value={form.senderEmail} onChange={(e) => setForm({ ...form, senderEmail: e.target.value })} />
          {isLikelyPersonalEmailDomain(form.senderEmail) && (
            <p className="text-xs text-amber-600 sm:col-span-2">
              This looks like a personal inbox, not a domain you own — email providers can only send from a domain you've verified, so sends from this address will fail. Use an address at your own verified domain instead, or leave this blank to use your outreach settings default.
            </p>
          )}
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create campaign'}</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {campaigns.length === 0 ? (
          <EmptyState icon={<Megaphone className="h-6 w-6" />} title="No campaigns yet" description="Create a campaign, attach a sequence, and add contacts to get started." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {campaigns.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Link to={`/outreach/campaigns/${c.id}`} className="font-medium text-brand-700 hover:underline">{c.name}</Link>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {Object.entries(c.contactCounts).map(([status, count]) => `${count} ${status}`).join(', ') || 'No contacts yet'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link to={`/outreach/campaigns/${c.id}`} className="btn-secondary">Manage</Link>
                  <button className="text-slate-400 hover:text-red-500" aria-label="Delete campaign" onClick={() => setDeleteTarget(c)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this campaign?"
        description={`This permanently removes "${deleteTarget?.name ?? ''}", its contacts' progress, drafts, and sent-message history. This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
