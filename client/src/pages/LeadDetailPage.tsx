import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Plus, Clock, CheckCircle2 } from 'lucide-react';
import * as leadsApi from '../services/leadsApi';
import * as followUpsApi from '../services/followUpsApi';
import { listUsers } from '../services/usersApi';
import { Lead, Activity, Note, FollowUp, AiQualification, LEAD_STATUSES, FOLLOW_UP_TYPES, User } from '../types';
import StatusBadge from '../components/StatusBadge';
import ScoreBadge from '../components/ScoreBadge';
import PriorityBadge from '../components/PriorityBadge';
import SlaBadge from '../components/SlaBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { ApiError } from '../lib/api';

function currency(value: string | number | null): string {
  if (value === null || value === '') return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value));
}

export default function LeadDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [aiQual, setAiQual] = useState<AiQualification | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({ type: 'Call', scheduledAt: '', notes: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const [leadRes, actRes, noteRes, fuRes, aiRes] = await Promise.all([
        leadsApi.getLead(id),
        leadsApi.listActivities(id),
        leadsApi.listNotes(id),
        leadsApi.listLeadFollowUps(id),
        leadsApi.getLatestAiQualification(id).catch(() => ({ qualification: null })),
      ]);
      setLead(leadRes.lead);
      setActivities(actRes.activities);
      setNotes(noteRes.notes);
      setFollowUps(fuRes.followUps);
      setAiQual(aiRes.qualification);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
      } else {
        setError('Unable to load this lead.');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (user?.role === 'owner') {
      listUsers().then((res) => setUsers(res.users)).catch(() => undefined);
    }
  }, [user]);

  async function handleStatusChange(status: string) {
    if (!lead) return;
    try {
      const res = await leadsApi.updateLead(lead.id, { status });
      setLead(res.lead);
      showToast(`Status updated to ${status}.`);
      load();
    } catch {
      showToast('Unable to update status.', 'error');
    }
  }

  async function handleAssign(userId: string) {
    if (!lead) return;
    try {
      const res = await leadsApi.updateLead(lead.id, { assignedUserId: userId || null });
      setLead(res.lead);
      showToast('Lead reassigned.');
    } catch {
      showToast('Unable to reassign lead.', 'error');
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!lead || !noteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await leadsApi.createNote(lead.id, noteText.trim());
      setNotes((prev) => [res.note, ...prev]);
      setNoteText('');
      showToast('Note added.');
      leadsApi.listActivities(lead.id).then((r) => setActivities(r.activities));
    } catch {
      showToast('Unable to add note.', 'error');
    } finally {
      setSavingNote(false);
    }
  }

  async function handleQualifyAi() {
    if (!lead) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await leadsApi.qualifyLeadAi(lead.id);
      setAiQual(res.qualification);
      showToast('AI qualification complete.');
      leadsApi.listActivities(lead.id).then((r) => setActivities(r.activities));
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setAiError(err.message);
      } else {
        setAiError('AI qualification failed. Please try again.');
      }
    } finally {
      setAiLoading(false);
    }
  }

  async function handleCreateFollowUp(e: React.FormEvent) {
    e.preventDefault();
    if (!lead || !followUpForm.scheduledAt) return;
    try {
      await followUpsApi.createFollowUp({
        leadId: lead.id,
        type: followUpForm.type,
        scheduledAt: new Date(followUpForm.scheduledAt).toISOString(),
        notes: followUpForm.notes || undefined,
      });
      showToast('Follow-up scheduled.');
      setShowFollowUpForm(false);
      setFollowUpForm({ type: 'Call', scheduledAt: '', notes: '' });
      leadsApi.listLeadFollowUps(lead.id).then((r) => setFollowUps(r.followUps));
    } catch {
      showToast('Unable to schedule follow-up.', 'error');
    }
  }

  async function handleCompleteFollowUp(followUpId: string) {
    try {
      await followUpsApi.updateFollowUp(followUpId, { completed: true });
      showToast('Follow-up marked completed.');
      if (lead) leadsApi.listLeadFollowUps(lead.id).then((r) => setFollowUps(r.followUps));
    } catch {
      showToast('Unable to update follow-up.', 'error');
    }
  }

  async function handleDelete() {
    if (!lead) return;
    try {
      await leadsApi.deleteLead(lead.id);
      showToast('Lead deleted.');
      navigate('/leads');
    } catch {
      showToast('Unable to delete lead.', 'error');
    }
  }

  if (loading) return <LoadingSpinner label="Loading lead..." />;
  if (notFound) {
    return (
      <EmptyState
        title="Lead not found"
        description="This lead may have been deleted, or you may not have access to it."
        action={<Link to="/leads" className="btn-primary">Back to leads</Link>}
      />
    );
  }
  if (error || !lead) return <ErrorState message={error ?? 'Unknown error'} onRetry={load} />;

  const upcomingFollowUps = followUps.filter((f) => !f.completed_at);
  const completedFollowUps = followUps.filter((f) => f.completed_at);

  return (
    <div className="space-y-6">
      <Link to="/leads" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">{lead.name}</h1>
            <StatusBadge status={lead.status} />
            <ScoreBadge score={lead.score} />
            <PriorityBadge priority={lead.priority} />
            <SlaBadge state={lead.sla_state} dueAt={lead.sla_due_at} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{lead.company || 'No company specified'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="select" value={lead.status} onChange={(e) => handleStatusChange(e.target.value)} aria-label="Change lead status">
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {user?.role === 'owner' && (
            <button className="btn-danger" onClick={() => setShowDeleteConfirm(true)}>Delete</button>
          )}
        </div>
      </div>

      {lead.duplicate_of_lead_id && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This lead was flagged as a possible duplicate of{' '}
          <Link to={`/leads/${lead.duplicate_of_lead_id}`} className="font-medium underline">another lead</Link>
          {lead.merged_at ? ' and has been merged into it.' : '. Review and merge if appropriate.'}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">Lead information</h2>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Email</dt><dd className="text-sm text-slate-800">{lead.email || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">Phone</dt><dd className="text-sm text-slate-800">{lead.phone || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">Industry</dt><dd className="text-sm text-slate-800">{lead.industry || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">Source</dt><dd className="text-sm text-slate-800">{lead.source}</dd></div>
              <div><dt className="text-xs text-slate-500">Interested in</dt><dd className="text-sm text-slate-800">{lead.interested_in || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">Budget</dt><dd className="text-sm text-slate-800">{currency(lead.budget)}</dd></div>
              <div><dt className="text-xs text-slate-500">Timeline</dt><dd className="text-sm text-slate-800">{lead.timeline || '—'}</dd></div>
              <div>
                <dt className="text-xs text-slate-500">Assigned to</dt>
                <dd className="text-sm text-slate-800">
                  {user?.role === 'owner' ? (
                    <select className="select mt-1" value={lead.assigned_user_id ?? ''} onChange={(e) => handleAssign(e.target.value)} aria-label="Reassign lead">
                      <option value="">Unassigned</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  ) : (
                    lead.assigned_user_name || 'Unassigned'
                  )}
                </dd>
              </div>
            </dl>
            {lead.description && (
              <div className="mt-4">
                <dt className="text-xs text-slate-500">Description</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{lead.description}</dd>
              </div>
            )}
          </div>

          {(lead.campaign || lead.utm_campaign || lead.ad || lead.ad_set || lead.utm_source || lead.landing_page) && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900">Marketing attribution</h2>
              <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(lead.campaign || lead.utm_campaign) && (
                  <div><dt className="text-xs text-slate-500">Campaign</dt><dd className="text-sm text-slate-800">{lead.campaign || lead.utm_campaign}</dd></div>
                )}
                {lead.ad_set && <div><dt className="text-xs text-slate-500">Ad Set</dt><dd className="text-sm text-slate-800">{lead.ad_set}</dd></div>}
                {lead.ad && <div><dt className="text-xs text-slate-500">Ad</dt><dd className="text-sm text-slate-800">{lead.ad}</dd></div>}
                {lead.utm_source && <div><dt className="text-xs text-slate-500">UTM Source</dt><dd className="text-sm text-slate-800">{lead.utm_source}</dd></div>}
                {lead.utm_medium && <div><dt className="text-xs text-slate-500">UTM Medium</dt><dd className="text-sm text-slate-800">{lead.utm_medium}</dd></div>}
                {lead.landing_page && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-500">Landing page</dt>
                    <dd className="truncate text-sm text-slate-800">{lead.landing_page}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">Notes</h2>
            <form onSubmit={handleAddNote} className="mt-3 flex gap-2">
              <input className="input" placeholder="Add a note..." value={noteText} onChange={(e) => setNoteText(e.target.value)} aria-label="New note" />
              <button type="submit" disabled={savingNote || !noteText.trim()} className="btn-primary shrink-0">Add</button>
            </form>
            <ul className="mt-4 space-y-3">
              {notes.length === 0 && <p className="text-sm text-slate-500">No notes yet.</p>}
              {notes.map((n) => (
                <li key={n.id} className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm">
                  <p className="text-slate-700">{n.content}</p>
                  <p className="mt-1 text-xs text-slate-400">{n.user_name || 'Unknown'} &middot; {new Date(n.created_at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">Activity timeline</h2>
            {activities.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No activity yet.</p>
            ) : (
              <ol className="mt-3 space-y-3 border-l border-slate-200 pl-4">
                {activities.map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-brand-500" aria-hidden="true" />
                    <p className="text-sm font-medium text-slate-800">{a.type}</p>
                    <p className="text-sm text-slate-600">{a.description}</p>
                    <p className="text-xs text-slate-400">{new Date(a.created_at).toLocaleString()}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">AI Qualification</h2>
              <Sparkles className="h-4 w-4 text-brand-500" aria-hidden="true" />
            </div>

            {aiError && <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{aiError}</div>}

            {aiQual ? (
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <ScoreBadge score={aiQual.score} />
                  <span className="font-medium text-slate-800">{aiQual.qualification}</span>
                </div>
                <p className="text-slate-600">{aiQual.summary}</p>
                <div>
                  <p className="text-xs font-medium text-slate-500">Reasoning</p>
                  <p className="text-slate-600">{aiQual.reasoning}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Recommended action</p>
                  <p className="text-slate-600">{aiQual.recommended_action}</p>
                </div>
                {aiQual.strengths && (
                  <div>
                    <p className="text-xs font-medium text-slate-500">Strengths</p>
                    <p className="text-slate-600">{aiQual.strengths}</p>
                  </div>
                )}
                {aiQual.concerns && (
                  <div>
                    <p className="text-xs font-medium text-slate-500">Concerns</p>
                    <p className="text-slate-600">{aiQual.concerns}</p>
                  </div>
                )}
                {aiQual.suggested_response && (
                  <div>
                    <p className="text-xs font-medium text-slate-500">Suggested response</p>
                    <p className="italic text-slate-600">&ldquo;{aiQual.suggested_response}&rdquo;</p>
                  </div>
                )}
                <p className="text-xs italic text-slate-400">AI-generated assessment — use judgment.</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No AI qualification available yet.</p>
            )}

            <button className="btn-primary mt-4 w-full" onClick={handleQualifyAi} disabled={aiLoading}>
              <Sparkles className="h-4 w-4" />
              {aiLoading ? 'Qualifying...' : 'Qualify Lead with AI'}
            </button>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Follow-ups</h2>
              <button className="btn-secondary" onClick={() => setShowFollowUpForm((v) => !v)}>
                <Plus className="h-4 w-4" /> New
              </button>
            </div>

            {showFollowUpForm && (
              <form onSubmit={handleCreateFollowUp} className="mt-3 space-y-2 rounded-md border border-slate-200 p-3">
                <select className="select" value={followUpForm.type} onChange={(e) => setFollowUpForm((f) => ({ ...f, type: e.target.value }))} aria-label="Follow-up type">
                  {FOLLOW_UP_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <input type="datetime-local" required className="input" value={followUpForm.scheduledAt} onChange={(e) => setFollowUpForm((f) => ({ ...f, scheduledAt: e.target.value }))} aria-label="Scheduled date and time" />
                <textarea className="input" placeholder="Notes (optional)" value={followUpForm.notes} onChange={(e) => setFollowUpForm((f) => ({ ...f, notes: e.target.value }))} />
                <button type="submit" className="btn-primary w-full">Schedule</button>
              </form>
            )}

            <div className="mt-4">
              <p className="text-xs font-medium uppercase text-slate-500">Upcoming</p>
              {upcomingFollowUps.length === 0 ? (
                <p className="mt-1 text-sm text-slate-500">No upcoming follow-ups.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {upcomingFollowUps.map((f) => {
                    const overdue = new Date(f.scheduled_at).getTime() < Date.now();
                    return (
                      <li key={f.id} className={`flex items-start justify-between gap-2 rounded-md border p-2 text-sm ${overdue ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50'}`}>
                        <div>
                          <p className="font-medium text-slate-800">{f.type} {overdue && <span className="text-red-600">(Overdue)</span>}</p>
                          <p className="flex items-center gap-1 text-xs text-slate-500"><Clock className="h-3 w-3" />{new Date(f.scheduled_at).toLocaleString()}</p>
                        </div>
                        <button className="text-brand-600 hover:text-brand-700" onClick={() => handleCompleteFollowUp(f.id)} aria-label="Mark completed">
                          <CheckCircle2 className="h-5 w-5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {completedFollowUps.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase text-slate-500">Completed</p>
                <ul className="mt-2 space-y-2">
                  {completedFollowUps.map((f) => (
                    <li key={f.id} className="rounded-md border border-slate-100 p-2 text-sm text-slate-500">
                      {f.type} &middot; completed {new Date(f.completed_at!).toLocaleDateString()}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete this lead?"
        description="This will permanently remove the lead and all associated notes, activities, and follow-ups."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
