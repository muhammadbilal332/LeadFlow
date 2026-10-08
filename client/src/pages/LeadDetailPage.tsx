import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Plus, Clock, CheckCircle2, Mail, Linkedin, Send, ChevronDown, ChevronUp } from 'lucide-react';
import * as leadsApi from '../services/leadsApi';
import * as followUpsApi from '../services/followUpsApi';
import * as outreachApi from '../services/outreachApi';
import { listUsers } from '../services/usersApi';
import { Lead, Activity, Note, FollowUp, LEAD_STATUSES, FOLLOW_UP_TYPES, User, LeadEmailHistory, OutreachDraft } from '../types';
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

const FOLLOW_UP_STATUS_STYLES: Record<string, string> = {
  none: 'bg-slate-100 text-slate-600',
  not_sent: 'bg-slate-100 text-slate-600',
  pending: 'bg-amber-100 text-amber-800',
  overdue: 'bg-red-100 text-red-700',
  sent: 'bg-emerald-100 text-emerald-700',
  stopped: 'bg-slate-100 text-slate-500',
  completed: 'bg-emerald-100 text-emerald-700',
};

type Tab = 'info' | 'hook' | 'email' | 'linkedin' | 'followups';

const TABS: Array<{ key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'info', label: 'Lead Information', icon: Sparkles },
  { key: 'hook', label: 'Hook & Observations', icon: Sparkles },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { key: 'followups', label: 'Follow-Ups', icon: Clock },
];

export default function LeadDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [emailHistory, setEmailHistory] = useState<LeadEmailHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [tab, setTab] = useState<Tab>('info');

  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({ type: 'Call', scheduledAt: '', notes: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [linkedinDraft, setLinkedinDraft] = useState('');
  const [savingLinkedin, setSavingLinkedin] = useState(false);

  const [composerDraft, setComposerDraft] = useState<OutreachDraft | null>(null);
  const [composerLoading, setComposerLoading] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [composerSubject, setComposerSubject] = useState('');
  const [composerBody, setComposerBody] = useState('');
  const [sending, setSending] = useState(false);

  const canManageTeam = user?.role === 'owner' || user?.role === 'manager';

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const [leadRes, actRes, noteRes, fuRes, emailRes] = await Promise.all([
        leadsApi.getLead(id),
        leadsApi.listActivities(id),
        leadsApi.listNotes(id),
        leadsApi.listLeadFollowUps(id),
        leadsApi.getLeadEmailHistory(id).catch(() => null),
      ]);
      setLead(leadRes.lead);
      setActivities(actRes.activities);
      setNotes(noteRes.notes);
      setFollowUps(fuRes.followUps);
      setEmailHistory(emailRes);
      setLinkedinDraft(leadRes.lead.linkedin_url ?? '');
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
    if (canManageTeam) {
      listUsers().then((res) => setUsers(res.users)).catch(() => undefined);
    }
  }, [canManageTeam]);

  async function refreshEmailHistory() {
    if (!id) return;
    const res = await leadsApi.getLeadEmailHistory(id).catch(() => null);
    setEmailHistory(res);
  }

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

  async function handleSaveLinkedin() {
    if (!lead) return;
    setSavingLinkedin(true);
    try {
      const res = await leadsApi.updateLead(lead.id, { linkedinUrl: linkedinDraft.trim() || null });
      setLead(res.lead);
      showToast('LinkedIn saved.');
    } catch {
      showToast('Unable to save LinkedIn URL.', 'error');
    } finally {
      setSavingLinkedin(false);
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

  async function handleOpenComposer() {
    if (!lead) return;
    setComposerLoading(true);
    setComposerError(null);
    setComposerDraft(null);
    try {
      const res = await leadsApi.composeLeadEmail(lead.id);
      setComposerDraft(res.draft);
      setComposerSubject(res.draft.subject);
      setComposerBody(res.draft.final_body ?? res.draft.naturalized_body);
    } catch (err) {
      setComposerError(err instanceof ApiError ? err.message : 'Unable to prepare a draft for this lead.');
    } finally {
      setComposerLoading(false);
    }
  }

  async function handleSendComposer() {
    if (!composerDraft) return;
    setSending(true);
    try {
      if (composerSubject !== composerDraft.subject || composerBody !== (composerDraft.final_body ?? composerDraft.naturalized_body)) {
        await outreachApi.updateDraft(composerDraft.id, { subject: composerSubject, finalBody: composerBody });
      }
      const res = await outreachApi.approveDraft(composerDraft.id);
      if (res.sendOutcome === 'sent') {
        showToast('Email sent.');
      } else if (res.sendOutcome === 'blocked') {
        showToast('This address is suppressed — email was not sent.', 'error');
      } else {
        showToast('Draft approved — it will send on the next queue run.', 'error');
      }
      setComposerDraft(null);
      await Promise.all([refreshEmailHistory(), load()]);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Unable to send this email.', 'error');
    } finally {
      setSending(false);
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
  const followUpStatus = emailHistory?.followUpStatus;

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
            {followUpStatus && (
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${FOLLOW_UP_STATUS_STYLES[followUpStatus.state]}`}>
                {followUpStatus.label}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">{lead.company || 'No company specified'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="select" value={lead.status} onChange={(e) => handleStatusChange(e.target.value)} aria-label="Change lead status">
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {(user?.role === 'owner' || user?.role === 'manager') && (
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

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {tab === 'info' && (
            <>
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-slate-900">Lead information</h2>
                <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><dt className="text-xs text-slate-500">Email</dt><dd className="text-sm text-slate-800">{lead.email || '—'}</dd></div>
                  <div><dt className="text-xs text-slate-500">Phone</dt><dd className="text-sm text-slate-800">{lead.phone || '—'}</dd></div>
                  <div><dt className="text-xs text-slate-500">Industry</dt><dd className="text-sm text-slate-800">{lead.industry || '—'}</dd></div>
                  <div><dt className="text-xs text-slate-500">Interested in</dt><dd className="text-sm text-slate-800">{lead.interested_in || '—'}</dd></div>
                  <div><dt className="text-xs text-slate-500">Timeline</dt><dd className="text-sm text-slate-800">{lead.timeline || '—'}</dd></div>
                  <div>
                    <dt className="text-xs text-slate-500">Assigned to</dt>
                    <dd className="text-sm text-slate-800">
                      {canManageTeam ? (
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

              {(lead.campaign || lead.utm_campaign || lead.ad || lead.ad_set || lead.landing_page) && (
                <div className="card p-5">
                  <h2 className="text-sm font-semibold text-slate-900">Marketing attribution</h2>
                  <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {(lead.campaign || lead.utm_campaign) && (
                      <div><dt className="text-xs text-slate-500">Campaign</dt><dd className="text-sm text-slate-800">{lead.campaign || lead.utm_campaign}</dd></div>
                    )}
                    {lead.ad_set && <div><dt className="text-xs text-slate-500">Ad Set</dt><dd className="text-sm text-slate-800">{lead.ad_set}</dd></div>}
                    {lead.ad && <div><dt className="text-xs text-slate-500">Ad</dt><dd className="text-sm text-slate-800">{lead.ad}</dd></div>}
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
            </>
          )}

          {tab === 'hook' && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900">Hook &amp; Observations</h2>
              <p className="mt-1 text-xs text-slate-500">The outreach personalization context used to generate this lead's emails.</p>
              {!emailHistory?.contact ? (
                <p className="mt-3 text-sm text-slate-500">No outreach contact linked yet — compose an email from the Email tab to populate this.</p>
              ) : (
                <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><dt className="text-xs text-slate-500">Website</dt><dd className="text-sm text-slate-800">{emailHistory.contact.website || '—'}</dd></div>
                  <div><dt className="text-xs text-slate-500">Location</dt><dd className="text-sm text-slate-800">{emailHistory.contact.location || '—'}</dd></div>
                  <div><dt className="text-xs text-slate-500">Industry</dt><dd className="text-sm text-slate-800">{emailHistory.contact.industry || '—'}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Pain points (the hook)</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{emailHistory.contact.pain_points || '—'}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Possible solution</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{emailHistory.contact.possible_solution || '—'}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Notes</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{emailHistory.contact.notes || '—'}</dd></div>
                </dl>
              )}
            </div>
          )}

          {tab === 'linkedin' && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900">LinkedIn</h2>
              <div className="mt-3 flex gap-2">
                <input
                  className="input"
                  placeholder="https://www.linkedin.com/in/..."
                  value={linkedinDraft}
                  onChange={(e) => setLinkedinDraft(e.target.value)}
                  aria-label="LinkedIn URL"
                />
                <button className="btn-primary shrink-0" onClick={handleSaveLinkedin} disabled={savingLinkedin}>
                  {savingLinkedin ? 'Saving...' : 'Save'}
                </button>
              </div>
              {lead.linkedin_url && (
                <a href={lead.linkedin_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
                  <Linkedin className="h-4 w-4" /> Open profile
                </a>
              )}
              {!lead.linkedin_url && <p className="mt-3 text-sm text-slate-500">No LinkedIn profile on file yet.</p>}
            </div>
          )}

          {tab === 'email' && (
            <div className="space-y-4">
              <div className="card p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">Context used for emails</h2>
                  <span className="text-xs text-slate-500">From your Google Sheet</span>
                </div>
                {!emailHistory?.contact ? (
                  <p className="mt-3 text-sm text-slate-500">
                    No sheet data is linked to this lead yet. Import it from a Google Sheet, or add the details on the Hook &amp; Observations tab.
                  </p>
                ) : (
                  <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div><dt className="text-xs text-slate-500">Contact</dt><dd className="text-sm text-slate-800">{emailHistory.contact.contact_name || '—'}</dd></div>
                    <div><dt className="text-xs text-slate-500">Company</dt><dd className="text-sm text-slate-800">{emailHistory.contact.company_name || '—'}</dd></div>
                    <div><dt className="text-xs text-slate-500">Industry</dt><dd className="text-sm text-slate-800">{emailHistory.contact.industry || '—'}</dd></div>
                    <div><dt className="text-xs text-slate-500">Location</dt><dd className="text-sm text-slate-800">{emailHistory.contact.location || '—'}</dd></div>
                    <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Pain points</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{emailHistory.contact.pain_points || '—'}</dd></div>
                    <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Possible solution</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{emailHistory.contact.possible_solution || '—'}</dd></div>
                    <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Notes</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{emailHistory.contact.notes || '—'}</dd></div>
                  </dl>
                )}
              </div>

              <div className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">Email History</h2>
                  <button className="btn-primary" onClick={handleOpenComposer} disabled={composerLoading || !lead.email}>
                    <Mail className="h-4 w-4" /> {composerLoading ? 'Preparing draft...' : 'Compose email'}
                  </button>
                </div>
                {!lead.email && <p className="mt-2 text-xs text-amber-700">This lead has no email address — add one to compose.</p>}

                {composerError && <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{composerError}</div>}

                {composerDraft && (
                  <div className="mt-4 space-y-2 rounded-md border border-brand-200 bg-brand-50/40 p-4">
                    <p className="text-xs font-medium uppercase text-brand-700">AI draft &mdash; review before sending</p>
                    <input className="input" value={composerSubject} onChange={(e) => setComposerSubject(e.target.value)} aria-label="Email subject" />
                    <textarea className="input min-h-[160px]" value={composerBody} onChange={(e) => setComposerBody(e.target.value)} aria-label="Email body" />
                    <div className="flex justify-end gap-2">
                      <button className="btn-secondary" onClick={() => setComposerDraft(null)} disabled={sending}>Discard</button>
                      <button className="btn-primary" onClick={handleSendComposer} disabled={sending}>
                        <Send className="h-4 w-4" /> {sending ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-4 space-y-2">
                  {!emailHistory || emailHistory.threads.length === 0 ? (
                    <p className="text-sm text-slate-500">No emails yet.</p>
                  ) : (
                    emailHistory.threads.map((thread) => {
                      const expanded = expandedThread === thread.id;
                      return (
                        <div key={thread.id} className="rounded-md border border-slate-200">
                          <button
                            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-slate-50"
                            onClick={() => setExpandedThread(expanded ? null : thread.id)}
                          >
                            <div>
                              <p className="text-sm font-medium text-slate-900">{thread.subject || '(no subject)'}</p>
                              <p className="text-xs text-slate-500">{new Date(thread.lastActivityAt).toLocaleString()} &middot; {thread.conversation.length} message{thread.conversation.length === 1 ? '' : 's'}</p>
                            </div>
                            {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                          </button>
                          {expanded && (
                            <ul className="space-y-2 border-t border-slate-100 p-3">
                              {thread.conversation.map((m) => (
                                <li
                                  key={`${m.direction}-${m.id}`}
                                  className={`max-w-[90%] rounded-lg p-2.5 text-sm ${m.direction === 'outgoing' ? 'ml-auto bg-brand-600 text-white' : 'mr-auto bg-slate-100 text-slate-800'}`}
                                >
                                  <p className="mb-1 text-xs font-medium uppercase tracking-wide opacity-70">
                                    {m.direction === 'outgoing' ? 'You' : lead.name}
                                    <span className="ml-2 font-normal normal-case opacity-80">{new Date(m.at).toLocaleString()}</span>
                                  </p>
                                  <p className="whitespace-pre-wrap">{m.body}</p>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'followups' && (
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Follow-ups</h2>
                <button className="btn-secondary" onClick={() => setShowFollowUpForm((v) => !v)}>
                  <Plus className="h-4 w-4" /> New reminder
                </button>
              </div>

              {followUpStatus && (
                <div className={`mt-3 rounded-md px-3 py-2 text-sm ${FOLLOW_UP_STATUS_STYLES[followUpStatus.state]}`}>
                  Automatic email follow-up: <span className="font-medium">{followUpStatus.label}</span>
                </div>
              )}

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
                  <p className="mt-1 text-sm text-slate-500">No upcoming manual reminders.</p>
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
          )}
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
