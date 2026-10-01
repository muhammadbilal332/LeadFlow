import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileText, Copy, Eye, EyeOff } from 'lucide-react';
import * as formsApi from '../services/formsApi';
import { LeadForm } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';

export default function FormsPage(): React.ReactElement {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await formsApi.listForms();
      setForms(res.forms);
    } catch {
      setError('Unable to load forms.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function copyLink(form: LeadForm) {
    try {
      const { publicUrl } = await formsApi.getEmbedInfo(form.id);
      await navigator.clipboard.writeText(publicUrl);
      showToast('Form link copied to clipboard.');
    } catch {
      showToast('Unable to copy link.', 'error');
    }
  }

  async function toggleStatus(form: LeadForm) {
    try {
      await formsApi.updateForm(form.id, { status: form.status === 'Active' ? 'Disabled' : 'Active' });
      showToast(form.status === 'Active' ? 'Form disabled.' : 'Form enabled.');
      load();
    } catch {
      showToast('Unable to update form.', 'error');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Lead capture forms</h1>
          <p className="text-sm text-slate-500">Public forms that create leads automatically, with full attribution.</p>
        </div>
        {user?.role === 'owner' && (
          <Link to="/forms/new" className="btn-primary">
            <Plus className="h-4 w-4" /> New form
          </Link>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading forms..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : forms.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No forms yet"
            description="Create a form to start capturing leads from your website or any page you can embed an iframe on."
            action={user?.role === 'owner' ? <Link to="/forms/new" className="btn-primary">Create your first form</Link> : undefined}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {forms.map((form) => (
              <li key={form.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Link to={`/forms/${form.id}`} className="font-medium text-brand-700 hover:underline">{form.name}</Link>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${form.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {form.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">/{form.slug} &middot; {(form.fields ?? []).length} custom field{(form.fields ?? []).length === 1 ? '' : 's'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary" onClick={() => copyLink(form)}>
                    <Copy className="h-3.5 w-3.5" /> Copy link
                  </button>
                  {user?.role === 'owner' && (
                    <>
                      <button className="btn-secondary" onClick={() => toggleStatus(form)}>
                        {form.status === 'Active' ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        {form.status === 'Active' ? 'Disable' : 'Enable'}
                      </button>
                      <Link to={`/forms/${form.id}`} className="btn-secondary">Edit</Link>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
