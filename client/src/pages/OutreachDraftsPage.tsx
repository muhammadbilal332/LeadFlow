import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileEdit, Check, X, RefreshCw, AlertTriangle, Sparkles, ExternalLink } from 'lucide-react';
import * as outreachApi from '../services/outreachApi';
import { getLeadEmailHistory } from '../services/leadsApi';
import { OutreachDraft, LeadEmailHistory } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import OutreachTabs from '../components/OutreachTabs';
import { useToast } from '../hooks/useToast';
import PageHeader from '../components/PageHeader';

/** The split-view panel: a recipient's Hook & Observations, fetched on demand — the same data as the Lead Detail page's own tab, without leaving Draft review. */
function HookPanel({ leadId, leadName, onClose }: { leadId: string; leadName: string; onClose: () => void }): React.ReactElement {
  const [history, setHistory] = useState<LeadEmailHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getLeadEmailHistory(leadId)
      .then((res) => {
        if (!cancelled) setHistory(res);
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load this lead\'s hook & observations.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  return (
    <div className="card sticky top-20 p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-brand-50 p-1.5 text-brand-600">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Hook &amp; Observations</h2>
            <p className="text-xs text-slate-500">{leadName}</p>
          </div>
        </div>
        <button className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" onClick={onClose} aria-label="Close panel">
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="py-8"><LoadingSpinner label="Loading..." /></div>
      ) : error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : !history?.contact ? (
        <p className="mt-4 text-sm text-slate-500">No outreach contact linked yet for this lead.</p>
      ) : (
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm">
          <div><dt className="text-xs text-slate-500">Website</dt><dd className="text-slate-800">{history.contact.website || '—'}</dd></div>
          <div><dt className="text-xs text-slate-500">Location</dt><dd className="text-slate-800">{history.contact.location || '—'}</dd></div>
          <div><dt className="text-xs text-slate-500">Industry</dt><dd className="text-slate-800">{history.contact.industry || '—'}</dd></div>
          <div><dt className="text-xs text-slate-500">Pain points (the hook)</dt><dd className="mt-1 whitespace-pre-wrap text-slate-800">{history.contact.pain_points || '—'}</dd></div>
          <div><dt className="text-xs text-slate-500">Possible solution</dt><dd className="mt-1 whitespace-pre-wrap text-slate-800">{history.contact.possible_solution || '—'}</dd></div>
          <div><dt className="text-xs text-slate-500">Notes</dt><dd className="mt-1 whitespace-pre-wrap text-slate-800">{history.contact.notes || '—'}</dd></div>
        </dl>
      )}

      <Link to={`/leads/${leadId}`} className="btn-secondary mt-4 w-full justify-center">
        <ExternalLink className="h-4 w-4" /> Open full lead
      </Link>
    </div>
  );
}

export default function OutreachDraftsPage(): React.ReactElement {
  const { showToast } = useToast();
  const [drafts, setDrafts] = useState<OutreachDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { subject: string; body: string }>>({});
  const [splitLead, setSplitLead] = useState<{ id: string; name: string } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await outreachApi.listDrafts();
      setDrafts(res.drafts);
      const nextEdits: Record<string, { subject: string; body: string }> = {};
      for (const d of res.drafts) nextEdits[d.id] = { subject: d.subject, body: d.final_body ?? d.naturalized_body };
      setEdits(nextEdits);
    } catch {
      setError('Unable to load drafts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(draft: OutreachDraft) {
    setBusyId(draft.id);
    try {
      const edit = edits[draft.id];
      if (edit && (edit.subject !== draft.subject || edit.body !== (draft.final_body ?? draft.naturalized_body))) {
        await outreachApi.updateDraft(draft.id, { subject: edit.subject, finalBody: edit.body });
      }
      const res = await outreachApi.approveDraft(draft.id);
      if (res.sendOutcome === 'sent') {
        showToast('Approved and sent.');
      } else if (res.sendOutcome === 'failed') {
        showToast('Approved, but the send failed — check the campaign for details.', 'error');
      } else if (res.sendOutcome === 'blocked') {
        showToast('Approved, but sending was blocked (e.g. a suppressed recipient).', 'error');
      } else {
        showToast('Draft approved — it will send once the campaign starts.');
      }
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to approve this draft.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    setBusyId(id);
    try {
      await outreachApi.rejectDraft(id);
      showToast('Draft rejected.');
      load();
    } catch {
      showToast('Unable to reject draft.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRegenerate(id: string) {
    setBusyId(id);
    try {
      await outreachApi.regenerateDraft(id);
      showToast('New draft generated.');
      load();
    } catch {
      showToast('Unable to regenerate draft.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <LoadingSpinner label="Loading drafts..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <OutreachTabs />
      <PageHeader eyebrow="Outreach" title="Draft review" description="Nothing sends until you approve it here. Edit freely before approving." />

      {drafts.length === 0 ? (
        <div className="card">
          <EmptyState icon={<FileEdit className="h-6 w-6" />} title="No drafts pending review" description="Generate drafts from a campaign to see them here." />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className={`space-y-3 ${splitLead ? 'lg:col-span-3' : 'lg:col-span-5'}`}>
            {drafts.map((d) => {
              const edit = edits[d.id] ?? { subject: d.subject, body: d.naturalized_body };
              const recipientLabel = d.recipient_name || d.recipient_email;
              return (
                <div key={d.id} className="card p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      d.quality_status === 'blocked' ? 'bg-red-100 text-red-700' : d.quality_status === 'warnings' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {d.quality_status === 'blocked' && <AlertTriangle className="h-3 w-3" />} Quality: {d.quality_status}
                    </span>
                    <span className="text-xs text-slate-400">Step {d.step_order}</span>
                  </div>

                  <div className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-sm">
                    {d.lead_id ? (
                      <button
                        type="button"
                        onClick={() => setSplitLead({ id: d.lead_id as string, name: recipientLabel || 'This lead' })}
                        className="text-left font-medium text-slate-900 hover:text-brand-600"
                        title="Open this lead's Hook & Observations"
                      >
                        To: {recipientLabel}{' '}
                        <span className="font-normal text-slate-500">&lt;{d.recipient_email}&gt;</span>
                      </button>
                    ) : (
                      <p className="font-medium text-slate-900">
                        To: {recipientLabel}{' '}
                        <span className="font-normal text-slate-500">&lt;{d.recipient_email}&gt;</span>
                      </p>
                    )}
                    <p className="text-xs text-slate-500">Company: {d.company_name || 'Not set'}</p>
                    <p className="mt-1 text-xs text-slate-400">The sign-off uses the first name of whoever approves this draft.</p>
                  </div>

                  {d.quality_issues.length > 0 && (
                    <ul className="mb-2 space-y-0.5 text-xs text-slate-500">
                      {d.quality_issues.map((issue, i) => (
                        <li key={i} className={issue.severity === 'blocking' ? 'text-red-600' : 'text-amber-600'}>&bull; {issue.message}</li>
                      ))}
                    </ul>
                  )}

                  <input
                    className="input mb-2 font-medium"
                    value={edit.subject}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [d.id]: { ...edit, subject: e.target.value } }))}
                  />
                  <textarea
                    className="input min-h-[140px]"
                    value={edit.body}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [d.id]: { ...edit, body: e.target.value } }))}
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn-primary" disabled={busyId === d.id || d.quality_status === 'blocked'} onClick={() => handleApprove(d)}>
                      <Check className="h-4 w-4" /> Approve
                    </button>
                    <button className="btn-secondary" disabled={busyId === d.id} onClick={() => handleRegenerate(d.id)}>
                      <RefreshCw className="h-4 w-4" /> Regenerate
                    </button>
                    <button className="btn-secondary" disabled={busyId === d.id} onClick={() => handleReject(d.id)}>
                      <X className="h-4 w-4" /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {splitLead && (
            <div className="lg:col-span-2">
              <HookPanel leadId={splitLead.id} leadName={splitLead.name} onClose={() => setSplitLead(null)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
