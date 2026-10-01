import React, { useEffect, useState } from 'react';
import { FileEdit, Check, X, RefreshCw, AlertTriangle } from 'lucide-react';
import * as outreachApi from '../services/outreachApi';
import { OutreachDraft } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import OutreachTabs from '../components/OutreachTabs';
import { useToast } from '../hooks/useToast';

export default function OutreachDraftsPage(): React.ReactElement {
  const { showToast } = useToast();
  const [drafts, setDrafts] = useState<OutreachDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { subject: string; body: string }>>({});

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
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Draft review</h1>
        <p className="text-sm text-slate-500">Nothing sends until you approve it here. Edit freely before approving.</p>
      </div>

      {drafts.length === 0 ? (
        <div className="card">
          <EmptyState icon={<FileEdit className="h-6 w-6" />} title="No drafts pending review" description="Generate drafts from a campaign to see them here." />
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((d) => {
            const edit = edits[d.id] ?? { subject: d.subject, body: d.naturalized_body };
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
      )}
    </div>
  );
}
