import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, CheckCircle2, Clock, CalendarClock, Mail, ChevronDown } from 'lucide-react';
import * as followUpsApi from '../services/followUpsApi';
import * as outreachApi from '../services/outreachApi';
import { listLeads } from '../services/leadsApi';
import { FollowUp, FOLLOW_UP_TYPES, Lead, FollowUpQueueBucket, FollowUpQueueItem } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import { useToast } from '../hooks/useToast';

type ManualTab = 'upcoming' | 'overdue' | 'completed';

const QUEUE_BUCKETS: Array<{ key: FollowUpQueueBucket; label: string }> = [
  { key: '3-day', label: '3-Day Follow-Up' },
  { key: '7-day', label: '7-Day Follow-Up' },
  { key: '14-day', label: '14-Day Follow-Up' },
  { key: '28-day', label: '28-Day Follow-Up' },
  { key: 'overdue', label: 'Overdue' },
];

function QueueItemRow({ item, onDrafted }: { item: FollowUpQueueItem; onDrafted: () => void }): React.ReactElement {
  const { showToast } = useToast();
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      await outreachApi.generateFollowUpDraft(item.campaign_contact_id);
      showToast('Draft generated — open the lead to review and send.');
      onDrafted();
    } catch {
      showToast('Unable to generate a draft for this follow-up.', 'error');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <li className={`flex items-center justify-between gap-3 rounded-xl border-l-4 bg-white p-4 shadow-soft ${item.bucket === 'overdue' ? 'border-l-red-400 bg-red-50/30' : 'border-l-slate-200'}`}>
      <div className="flex min-w-0 items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${item.bucket === 'overdue' ? 'bg-red-100 text-red-600' : 'bg-navy-900 text-white'}`}>
          {item.lead_name.trim().slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">
            <Link to={`/leads/${item.lead_id}`} className="hover:text-brand-600">
              {item.lead_name}
            </Link>
            {item.company && <span className="font-normal text-slate-500"> &middot; {item.company}</span>}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            due {new Date(item.next_send_at).toLocaleString()}
            {item.assigned_user_name && <span>&middot; {item.assigned_user_name}</span>}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {item.has_draft ? (
          <Link to={`/leads/${item.lead_id}`} className="btn-primary">
            <Mail className="h-4 w-4" /> Review &amp; send
          </Link>
        ) : (
          <button className="btn-secondary" onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generating...' : 'Generate draft'}
          </button>
        )}
      </div>
    </li>
  );
}

export default function FollowUpsPage(): React.ReactElement {
  const { showToast } = useToast();

  const [queue, setQueue] = useState<Record<FollowUpQueueBucket, FollowUpQueueItem[]> | null>(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [activeBucket, setActiveBucket] = useState<FollowUpQueueBucket>('3-day');

  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [manualTab, setManualTab] = useState<ManualTab>('upcoming');
  const [manualLoading, setManualLoading] = useState(true);
  const [manualError, setManualError] = useState<string | null>(null);
  const [showManualSection, setShowManualSection] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ leadId: '', type: 'Call', scheduledAt: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  async function loadQueue() {
    setQueueLoading(true);
    setQueueError(null);
    try {
      const res = await outreachApi.getFollowUpQueue();
      setQueue(res.queue);
    } catch {
      setQueueError('Unable to load the follow-up queue.');
    } finally {
      setQueueLoading(false);
    }
  }

  async function loadManual() {
    setManualLoading(true);
    setManualError(null);
    try {
      const res = await followUpsApi.listFollowUps();
      setFollowUps(res.followUps);
    } catch {
      setManualError('Unable to load follow-ups.');
    } finally {
      setManualLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
    loadManual();
    listLeads({ page: 1, pageSize: 200, sortBy: 'name', sortDir: 'asc' }).then((res) => setLeads(res.leads)).catch(() => undefined);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.leadId || !form.scheduledAt) return;
    setSubmitting(true);
    try {
      await followUpsApi.createFollowUp({
        leadId: form.leadId,
        type: form.type,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        notes: form.notes || undefined,
      });
      showToast('Follow-up scheduled.');
      setShowForm(false);
      setForm({ leadId: '', type: 'Call', scheduledAt: '', notes: '' });
      loadManual();
    } catch {
      showToast('Unable to schedule follow-up.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleComplete(id: string) {
    try {
      await followUpsApi.updateFollowUp(id, { completed: true });
      showToast('Follow-up marked completed.');
      loadManual();
    } catch {
      showToast('Unable to update follow-up.', 'error');
    }
  }

  const now = Date.now();
  const upcoming = followUps.filter((f) => !f.completed_at && new Date(f.scheduled_at).getTime() >= now);
  const overdue = followUps.filter((f) => !f.completed_at && new Date(f.scheduled_at).getTime() < now);
  const completed = followUps.filter((f) => f.completed_at);
  const visibleManual = manualTab === 'upcoming' ? upcoming : manualTab === 'overdue' ? overdue : completed;

  const activeItems = queue?.[activeBucket] ?? [];

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Workflow" title="Follow-ups" description="Your morning work queue — every lead whose next outreach follow-up is due." />

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {QUEUE_BUCKETS.map((b) => (
            <button
              key={b.key}
              onClick={() => setActiveBucket(b.key)}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                activeBucket === b.key ? 'bg-navy-900 text-white shadow-soft' : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {b.label} <span className="opacity-70">({queue?.[b.key].length ?? 0})</span>
            </button>
          ))}
        </div>

        {queueLoading ? (
          <LoadingSpinner label="Loading follow-up queue..." />
        ) : queueError ? (
          <ErrorState message={queueError} onRetry={loadQueue} />
        ) : activeItems.length === 0 ? (
          <EmptyState icon={<CalendarClock className="h-6 w-6" />} title="Nothing due here" description="Leads will show up in this tab once their next follow-up step becomes due." />
        ) : (
          <ul className="space-y-2">
            {activeItems.map((item) => (
              <QueueItemRow key={item.campaign_contact_id} item={item} onDrafted={loadQueue} />
            ))}
          </ul>
        )}
      </div>

      <div>
        <button
          onClick={() => setShowManualSection((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${showManualSection ? 'rotate-180' : ''}`} />
          Manual reminders (calls, meetings, etc.)
        </button>

        {showManualSection && (
          <div className="mt-3 space-y-4">
            <div className="flex justify-end">
              <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
                <Plus className="h-4 w-4" /> New reminder
              </button>
            </div>

            {showForm && (
              <div className="card p-4">
                <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <select className="select" required value={form.leadId} onChange={(e) => setForm((f) => ({ ...f, leadId: e.target.value }))} aria-label="Select lead">
                    <option value="">Select a lead...</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>{l.name} {l.company ? `(${l.company})` : ''}</option>
                    ))}
                  </select>
                  <select className="select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} aria-label="Follow-up type">
                    {FOLLOW_UP_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <input type="datetime-local" required className="input" value={form.scheduledAt} onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))} aria-label="Scheduled date and time" />
                  <input className="input" placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                  <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2">
                    <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                    <button type="submit" disabled={submitting} className="btn-primary">{submitting ? 'Saving...' : 'Schedule'}</button>
                  </div>
                </form>
              </div>
            )}

            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
              {([
                ['upcoming', `Upcoming (${upcoming.length})`],
                ['overdue', `Overdue (${overdue.length})`],
                ['completed', `Completed (${completed.length})`],
              ] as [ManualTab, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setManualTab(key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${manualTab === key ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {manualLoading ? (
              <LoadingSpinner label="Loading follow-ups..." />
            ) : manualError ? (
              <ErrorState message={manualError} onRetry={loadManual} />
            ) : visibleManual.length === 0 ? (
              <EmptyState
                icon={<CalendarClock className="h-6 w-6" />}
                title="No manual reminders scheduled."
                description={manualTab === 'completed' ? 'Completed reminders will show up here.' : 'Schedule a reminder to stay on top of a lead.'}
              />
            ) : (
              <ul className="space-y-2">
                {visibleManual.map((f) => (
                  <li key={f.id} className={`flex items-center justify-between gap-3 rounded-xl border-l-4 bg-white p-4 shadow-soft ${manualTab === 'overdue' ? 'border-l-red-400 bg-red-50/30' : 'border-l-slate-200'}`}>
                    <div>
                      <p className="font-medium text-slate-900">
                        {f.type} with{' '}
                        <Link to={`/leads/${f.lead_id}`} className="text-brand-600 hover:underline">
                          {f.lead_name}
                        </Link>
                      </p>
                      <p className="flex items-center gap-1 text-sm text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(f.scheduled_at).toLocaleString()}
                        {f.user_name && <span>&middot; {f.user_name}</span>}
                      </p>
                      {f.notes && <p className="mt-1 text-sm text-slate-600">{f.notes}</p>}
                    </div>
                    {!f.completed_at && (
                      <button className="btn-secondary shrink-0" onClick={() => handleComplete(f.id)}>
                        <CheckCircle2 className="h-4 w-4" /> Mark done
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
