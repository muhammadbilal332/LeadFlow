import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, CheckCircle2, Clock, CalendarClock } from 'lucide-react';
import * as followUpsApi from '../services/followUpsApi';
import { listLeads } from '../services/leadsApi';
import { FollowUp, FOLLOW_UP_TYPES, Lead } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { useToast } from '../hooks/useToast';

type Tab = 'upcoming' | 'overdue' | 'completed';

export default function FollowUpsPage(): React.ReactElement {
  const { showToast } = useToast();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ leadId: '', type: 'Call', scheduledAt: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await followUpsApi.listFollowUps();
      setFollowUps(res.followUps);
    } catch {
      setError('Unable to load follow-ups.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
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
      load();
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
      load();
    } catch {
      showToast('Unable to update follow-up.', 'error');
    }
  }

  const now = Date.now();
  const upcoming = followUps.filter((f) => !f.completed_at && new Date(f.scheduled_at).getTime() >= now);
  const overdue = followUps.filter((f) => !f.completed_at && new Date(f.scheduled_at).getTime() < now);
  const completed = followUps.filter((f) => f.completed_at);

  const visible = tab === 'upcoming' ? upcoming : tab === 'overdue' ? overdue : completed;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Follow-ups</h1>
          <p className="text-sm text-slate-500">Stay on top of every scheduled touchpoint.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> New Follow-up
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

      <div className="flex gap-1 border-b border-slate-200">
        {([
          ['upcoming', `Upcoming (${upcoming.length})`],
          ['overdue', `Overdue (${overdue.length})`],
          ['completed', `Completed (${completed.length})`],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-2 text-sm font-medium ${tab === key ? 'border-b-2 border-brand-600 text-brand-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner label="Loading follow-ups..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-6 w-6" />}
          title="You don't have any follow-ups scheduled."
          description={tab === 'completed' ? 'Completed follow-ups will show up here.' : 'Schedule a follow-up to stay on top of your leads.'}
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((f) => (
            <li key={f.id} className={`card flex items-center justify-between gap-3 p-4 ${tab === 'overdue' ? 'border-red-200 bg-red-50/40' : ''}`}>
              <div>
                <p className="font-medium text-slate-900">
                  {f.type} with{' '}
                  <Link to={`/leads/${f.lead_id}`} className="text-brand-700 hover:underline">
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
  );
}
