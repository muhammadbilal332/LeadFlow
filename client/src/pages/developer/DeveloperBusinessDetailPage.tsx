import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Users2, Contact2, Megaphone, Calendar } from 'lucide-react';
import * as developerApi from '../../services/developerApi';
import { BusinessDetail } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useToast } from '../../hooks/useToast';

type Action = 'deactivate' | 'reactivate' | 'delete';

export default function DeveloperBusinessDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [business, setBusiness] = useState<BusinessDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await developerApi.getBusiness(id);
      setBusiness(res.business);
    } catch {
      setError('Unable to load this business.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleConfirm() {
    if (!business || !confirmAction) return;
    setBusy(true);
    try {
      if (confirmAction === 'deactivate') {
        await developerApi.deactivateBusiness(business.id);
        showToast(`${business.name} deactivated — its users can no longer log in.`);
        setConfirmAction(null);
        load();
      } else if (confirmAction === 'reactivate') {
        await developerApi.reactivateBusiness(business.id);
        showToast(`${business.name} reactivated.`);
        setConfirmAction(null);
        load();
      } else {
        await developerApi.deleteBusiness(business.id);
        showToast(`${business.name} permanently deleted.`);
        navigate('/developer/businesses');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to complete that action.', 'error');
      setConfirmAction(null);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingSpinner label="Loading business..." />;
  if (error || !business) return <ErrorState message={error ?? 'Business not found'} onRetry={load} />;

  return (
    <div className="space-y-4">
      <Link to="/developer/businesses" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to businesses
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-heading">{business.name}</h1>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${business.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {business.is_active ? 'Active' : 'Deactivated'}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">/{business.slug} &middot; owner {business.owner_name ?? 'Unknown'} ({business.owner_email ?? '—'})</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary"
            disabled={busy}
            onClick={() => setConfirmAction(business.is_active ? 'deactivate' : 'reactivate')}
          >
            {business.is_active ? 'Deactivate' : 'Reactivate'}
          </button>
          <button
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-transparent"
            disabled={busy || business.is_active}
            title={business.is_active ? 'Deactivate this business before deleting it' : undefined}
            onClick={() => setConfirmAction('delete')}
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-center gap-2 text-slate-500"><Users2 className="h-4 w-4" /><span className="eyebrow">Users</span></div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{business.user_count}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-slate-500"><Contact2 className="h-4 w-4" /><span className="eyebrow">Leads</span></div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{business.lead_count}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-slate-500"><Megaphone className="h-4 w-4" /><span className="eyebrow">Campaigns</span></div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{business.campaign_count}</p>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-900">Business details</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Email</dt>
            <dd className="text-slate-900">{business.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Phone</dt>
            <dd className="text-slate-900">{business.phone ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Industry</dt>
            <dd className="text-slate-900">{business.industry ?? '—'}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-xs text-slate-500"><Calendar className="h-3 w-3" /> Created</dt>
            <dd className="text-slate-900">{new Date(business.created_at).toLocaleString()}</dd>
          </div>
        </dl>
      </div>

      <ConfirmDialog
        open={!!confirmAction}
        title={
          confirmAction === 'deactivate' ? 'Deactivate this business?'
          : confirmAction === 'reactivate' ? 'Reactivate this business?'
          : 'Permanently delete this business?'
        }
        description={
          confirmAction === 'deactivate' ? `${business.name} and all of its users will immediately lose the ability to log in. This can be undone by reactivating.`
          : confirmAction === 'reactivate' ? `${business.name}'s users will regain the ability to log in.`
          : `${business.name} and all of its data — users, leads, outreach campaigns and messages — will be permanently deleted. This cannot be undone.`
        }
        confirmLabel={
          confirmAction === 'deactivate' ? 'Deactivate'
          : confirmAction === 'reactivate' ? 'Reactivate'
          : 'Delete permanently'
        }
        danger={confirmAction !== 'reactivate'}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
