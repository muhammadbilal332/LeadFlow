import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users2, Sheet, RefreshCw, Trash2 } from 'lucide-react';
import * as outreachApi from '../services/outreachApi';
import { OutreachContact, SheetImport } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import OutreachTabs from '../components/OutreachTabs';
import { useToast } from '../hooks/useToast';
import PageHeader from '../components/PageHeader';

const emptyForm = { email: '', contactName: '', companyName: '', industry: '', painPoints: '', possibleSolution: '' };

export default function OutreachContactsPage(): React.ReactElement {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<OutreachContact[]>([]);
  const [imports, setImports] = useState<SheetImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OutreachContact | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [c, i] = await Promise.all([outreachApi.listContacts(), outreachApi.listImports()]);
      setContacts(c.contacts);
      setImports(i.imports);
    } catch {
      setError('Unable to load contacts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleImport() {
    setImporting(true);
    try {
      const res = await outreachApi.triggerImport();
      const draftsGenerated = res.campaignResult?.draftsGenerated ?? 0;
      if (draftsGenerated > 0) {
        showToast(`Imported ${res.import.imported_rows} new contact(s) — ${draftsGenerated} draft${draftsGenerated === 1 ? '' : 's'} ready for your review.`);
        navigate('/outreach/drafts');
      } else {
        showToast(`Imported ${res.import.imported_rows} new contact(s), ${res.import.duplicate_rows} already existed.`);
        load();
      }
    } catch {
      showToast('Unable to import from sheet.', 'error');
    } finally {
      setImporting(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.trim()) return;
    setSaving(true);
    try {
      await outreachApi.createContact(form);
      showToast('Contact saved.');
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch {
      showToast('Unable to save contact.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await outreachApi.deleteContact(deleteTarget.id);
      showToast('Contact deleted.');
      setDeleteTarget(null);
      load();
    } catch {
      showToast('Unable to delete contact.', 'error');
    }
  }

  if (loading) return <LoadingSpinner label="Loading contacts..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <OutreachTabs />
      <PageHeader
        eyebrow="Outreach"
        title="Outreach contacts"
        description="Prospects you'll send personalized cold emails to."
        actions={
          <>
          <button className="btn-secondary" onClick={handleImport} disabled={importing}>
            <Sheet className="h-4 w-4" /> {importing ? 'Importing...' : 'Import from sheet'}
          </button>
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" /> Add contact
          </button>
          </>
        }
      />

      {showForm && (
        <form onSubmit={handleCreate} className="card grid gap-3 p-4 sm:grid-cols-2">
          <input className="input" placeholder="Email *" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input className="input" placeholder="Contact name" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          <input className="input" placeholder="Company name" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
          <input className="input" placeholder="Industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
          <textarea className="input sm:col-span-2" placeholder="Pain points" value={form.painPoints} onChange={(e) => setForm({ ...form, painPoints: e.target.value })} />
          <textarea className="input sm:col-span-2" placeholder="Our possible solution" value={form.possibleSolution} onChange={(e) => setForm({ ...form, possibleSolution: e.target.value })} />
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save contact'}</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {contacts.length === 0 ? (
          <EmptyState
            icon={<Users2 className="h-6 w-6" />}
            title="No contacts yet"
            description="Import from a Google Sheet (or the mock demo dataset) or add a contact manually."
            action={<button className="btn-primary" onClick={handleImport}>Import from sheet</button>}
          />
        ) : (
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Company</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">{c.contact_name || '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{c.company_name || '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{c.email}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${c.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button className="text-slate-400 hover:text-red-500" aria-label="Delete contact" onClick={() => setDeleteTarget(c)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this contact?"
        description={`This removes ${deleteTarget?.email ?? 'this contact'} and their progress in any campaigns. This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {imports.length > 0 && (
        <div className="card p-4">
          <p className="flex items-center gap-2 text-xs font-medium uppercase text-slate-500"><RefreshCw className="h-3.5 w-3.5" /> Recent imports</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {imports.map((i) => (
              <li key={i.id}>
                {new Date(i.created_at).toLocaleString()} &middot; {i.imported_rows} imported, {i.duplicate_rows} duplicate, {i.failed_rows} failed (of {i.total_rows})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
