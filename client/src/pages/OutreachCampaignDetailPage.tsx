import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Play, Pause, XCircle, UserPlus, Trash2, RefreshCw, Check, X, AlertTriangle, Sheet } from 'lucide-react';
import * as outreachApi from '../services/outreachApi';
import { OutreachCampaign, CampaignContact, OutreachContact, OutreachDraft } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../hooks/useToast';
import { humanizeSendFailure } from '../lib/outreachErrors';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  review: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  running: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-orange-100 text-orange-700',
  completed: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-red-100 text-red-700',
};

const CONTACT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-500',
  drafted: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  sent: 'bg-emerald-100 text-emerald-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  replied: 'bg-violet-100 text-violet-700',
  stopped: 'bg-slate-100 text-slate-500',
  failed: 'bg-red-100 text-red-700',
  bounced: 'bg-red-100 text-red-700',
  unsubscribed: 'bg-slate-100 text-slate-500',
};

export default function OutreachCampaignDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [campaign, setCampaign] = useState<OutreachCampaign | null>(null);
  const [contacts, setContacts] = useState<CampaignContact[]>([]);
  const [allContacts, setAllContacts] = useState<OutreachContact[]>([]);
  const [drafts, setDrafts] = useState<OutreachDraft[]>([]);
  const [draftEdits, setDraftEdits] = useState<Record<string, { subject: string; body: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [busyDraftId, setBusyDraftId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [detail, allC, draftsRes] = await Promise.all([outreachApi.getCampaign(id), outreachApi.listContacts({ page: 1 }), outreachApi.listDrafts(id)]);
      setCampaign(detail.campaign);
      setContacts(detail.contacts);
      setAllContacts(allC.contacts);
      setDrafts(draftsRes.drafts);
      const edits: Record<string, { subject: string; body: string }> = {};
      for (const d of draftsRes.drafts) edits[d.id] = { subject: d.subject, body: d.final_body ?? d.naturalized_body };
      setDraftEdits(edits);
    } catch {
      setError('Unable to load this campaign.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function runAction(action: () => Promise<unknown>, successMessage: string | ((res: any) => string)) {
    setBusy(true);
    try {
      const res = await action();
      showToast(typeof successMessage === 'function' ? successMessage(res) : successMessage);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCampaign() {
    if (!campaign) return;
    try {
      await outreachApi.deleteCampaign(campaign.id);
      showToast('Campaign deleted.');
      navigate('/outreach/campaigns');
    } catch {
      showToast('Unable to delete campaign.', 'error');
    }
  }

  async function handleImportFromSheet() {
    if (!campaign) return;
    setImporting(true);
    try {
      const res = await outreachApi.triggerImport({ campaignId: campaign.id });
      const drafted = res.campaignResult?.draftsGenerated ?? 0;
      showToast(`Imported ${res.import.imported_rows} new contact(s) (${res.import.duplicate_rows} already existed) — ${drafted} draft(s) ready for review.`);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to import from sheet.', 'error');
    } finally {
      setImporting(false);
    }
  }

  async function handleApproveDraft(draft: OutreachDraft) {
    setBusyDraftId(draft.id);
    try {
      const edit = draftEdits[draft.id];
      if (edit && (edit.subject !== draft.subject || edit.body !== (draft.final_body ?? draft.naturalized_body))) {
        await outreachApi.updateDraft(draft.id, { subject: edit.subject, finalBody: edit.body });
      }
      const res = await outreachApi.approveDraft(draft.id);
      showToast(res.sendOutcome === 'sent' ? 'Approved and sent.' : 'Draft approved.');
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to approve this draft.', 'error');
    } finally {
      setBusyDraftId(null);
    }
  }

  async function handleRejectDraft(id: string) {
    setBusyDraftId(id);
    try {
      await outreachApi.rejectDraft(id);
      showToast('Draft rejected.');
      load();
    } finally {
      setBusyDraftId(null);
    }
  }

  async function handleRegenerateDraft(id: string) {
    setBusyDraftId(id);
    try {
      await outreachApi.regenerateDraft(id);
      showToast('New draft generated.');
      load();
    } finally {
      setBusyDraftId(null);
    }
  }

  if (loading) return <LoadingSpinner label="Loading campaign..." />;
  if (error || !campaign) return <ErrorState message={error ?? 'Campaign not found'} onRetry={load} />;

  const availableContacts = allContacts.filter((c) => !contacts.some((cc) => cc.contact_id === c.id));
  const contactById = (contactId: string) => allContacts.find((c) => c.id === contactId);

  return (
    <div className="space-y-4">
      <Link to="/outreach/campaigns" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to campaigns
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-heading">{campaign.name}</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[campaign.status]}`}>{campaign.status}</span>
          </div>
          {campaign.status === 'draft' && <p className="mt-1 text-sm text-slate-500">Add contacts below — each one gets a draft automatically, ready for your review.</p>}
          {campaign.status === 'review' && <p className="mt-1 text-sm text-slate-500">Review the drafts below, then approve the campaign to move toward sending.</p>}
          {campaign.status === 'approved' && <p className="mt-1 text-sm text-slate-500">Ready — click Start to send every approved draft right away.</p>}
          {campaign.status === 'running' && <p className="mt-1 text-sm text-slate-500">Live. New drafts for follow-up steps appear here as they come due — approve them to keep the sequence moving.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {(campaign.status === 'draft' || campaign.status === 'review') && (
            <button className="btn-primary" disabled={busy} onClick={() => runAction(() => outreachApi.approveCampaign(campaign.id), 'Campaign approved.')}>
              <CheckCircle2 className="h-4 w-4" /> Approve campaign
            </button>
          )}
          {(campaign.status === 'approved' || campaign.status === 'paused') && (
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() =>
                runAction(
                  () => outreachApi.startCampaign(campaign.id),
                  (res) => `Campaign started — ${res.tickResult.sent} email(s) sent.`
                )
              }
            >
              <Play className="h-4 w-4" /> Start
            </button>
          )}
          {campaign.status === 'running' && (
            <button className="btn-secondary" disabled={busy} onClick={() => runAction(() => outreachApi.pauseCampaign(campaign.id), 'Campaign paused.')}>
              <Pause className="h-4 w-4" /> Pause
            </button>
          )}
          {!['completed', 'cancelled'].includes(campaign.status) && (
            <button className="btn-secondary" disabled={busy} onClick={() => runAction(() => outreachApi.cancelCampaign(campaign.id), 'Campaign cancelled.')}>
              <XCircle className="h-4 w-4" /> Cancel
            </button>
          )}
          <button className="btn-secondary text-red-600 hover:bg-red-50" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>

      {drafts.length > 0 && (
        <div className="space-y-3">
          <h2 className="eyebrow">Drafts awaiting your review ({drafts.length})</h2>
          {drafts.map((d) => {
            const edit = draftEdits[d.id] ?? { subject: d.subject, body: d.naturalized_body };
            const contact = contactById(contacts.find((cc) => cc.id === d.campaign_contact_id)?.contact_id ?? '');
            return (
              <div key={d.id} className="card p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">{contact?.contact_name || contact?.email || 'Contact'} <span className="font-normal text-slate-400">&middot; step {d.step_order}</span></p>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    d.quality_status === 'blocked' ? 'bg-red-100 text-red-700' : d.quality_status === 'warnings' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {d.quality_status === 'blocked' && <AlertTriangle className="h-3 w-3" />} {d.quality_status}
                  </span>
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
                  onChange={(e) => setDraftEdits((prev) => ({ ...prev, [d.id]: { ...edit, subject: e.target.value } }))}
                />
                <textarea
                  className="input min-h-[120px]"
                  value={edit.body}
                  onChange={(e) => setDraftEdits((prev) => ({ ...prev, [d.id]: { ...edit, body: e.target.value } }))}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-primary" disabled={busyDraftId === d.id || d.quality_status === 'blocked'} onClick={() => handleApproveDraft(d)}>
                    <Check className="h-4 w-4" /> Approve
                  </button>
                  <button className="btn-secondary" disabled={busyDraftId === d.id} onClick={() => handleRegenerateDraft(d.id)}>
                    <RefreshCw className="h-4 w-4" /> Regenerate
                  </button>
                  <button className="btn-secondary" disabled={busyDraftId === d.id} onClick={() => handleRejectDraft(d.id)}>
                    <X className="h-4 w-4" /> Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Contacts ({contacts.length})</p>
          {campaign.status !== 'cancelled' && campaign.status !== 'completed' && (
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={handleImportFromSheet} disabled={importing || !campaign.sequence_id}>
                <Sheet className="h-4 w-4" /> {importing ? 'Importing...' : 'Import from sheet'}
              </button>
              <button className="btn-secondary" onClick={() => setShowPicker((v) => !v)}>
                <UserPlus className="h-4 w-4" /> Add contacts
              </button>
            </div>
          )}
        </div>
        {!campaign.sequence_id && <p className="mt-2 text-xs text-amber-600">Attach a sequence to this campaign before importing or adding contacts.</p>}

        {showPicker && (
          <div className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
            {availableContacts.length === 0 ? (
              <p className="p-2 text-xs text-slate-500">No more contacts available — add some under the Contacts tab first.</p>
            ) : (
              availableContacts.map((c) => (
                <label key={c.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(c.id)}
                    onChange={(e) => setSelectedIds((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)))}
                  />
                  {c.contact_name || c.email} {c.company_name && <span className="text-slate-400">— {c.company_name}</span>}
                </label>
              ))
            )}
            <button
              className="btn-primary mt-2"
              disabled={selectedIds.length === 0 || busy || !campaign.sequence_id}
              onClick={() =>
                runAction(async () => {
                  const res = await outreachApi.addContactsToCampaign(campaign.id, selectedIds);
                  setSelectedIds([]);
                  setShowPicker(false);
                  return res;
                }, (res) => `${res.added} contact(s) added — ${res.draftsGenerated} draft(s) ready for review.`)
              }
            >
              Add {selectedIds.length || ''} contact(s)
            </button>
            {!campaign.sequence_id && <p className="mt-1 text-xs text-amber-600">This campaign has no sequence attached, so drafts can't be generated.</p>}
          </div>
        )}

        {contacts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No contacts yet — add some to get started.</p>
        ) : (
          <table className="mt-3 min-w-full divide-y divide-slate-100 text-sm">
            <thead className="text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="py-1.5">Contact</th>
                <th className="py-1.5">Status</th>
                <th className="py-1.5">Step</th>
                <th className="py-1.5">Next action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contacts.map((cc) => {
                const contact = contactById(cc.contact_id);
                return (
                  <tr key={cc.id}>
                    <td className="py-1.5">{contact?.contact_name || contact?.email || cc.contact_id}</td>
                    <td className="py-1.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CONTACT_STATUS_COLORS[cc.status] ?? 'bg-slate-100 text-slate-500'}`}>
                        {cc.status}
                      </span>
                      {cc.stopped_reason && <span className="ml-1 text-xs text-slate-400">({cc.stopped_reason})</span>}
                    </td>
                    <td className="py-1.5 text-slate-600">{cc.current_step}</td>
                    <td className="max-w-xs py-1.5 text-slate-500">
                      {cc.status === 'failed'
                        ? <span className="text-red-600" title={cc.failed_reason ?? undefined}>{humanizeSendFailure(cc.failed_reason)}</span>
                        : cc.status === 'drafted' ? 'Awaiting your review above'
                        : cc.status === 'approved' ? 'Ready to send — start/process the campaign'
                        : cc.status === 'bounced' || cc.status === 'stopped' || cc.status === 'unsubscribed' ? '—'
                        : cc.next_send_at ? `Next step ${new Date(cc.next_send_at).toLocaleDateString()}`
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this campaign?"
        description="This permanently removes the campaign, its contacts' progress, drafts, and sent-message history. This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={handleDeleteCampaign}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
