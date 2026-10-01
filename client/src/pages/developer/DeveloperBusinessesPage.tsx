import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import * as developerApi from '../../services/developerApi';
import { BusinessSummary } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useToast } from '../../hooks/useToast';

type Action = 'deactivate' | 'reactivate' | 'delete';

export default function DeveloperBusinessesPage(): React.ReactElement {
  const { showToast } = useToast();
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ business: BusinessSummary; action: Action } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await developerApi.listBusinesses();
      setBusinesses(res.businesses);
    } catch {
      setError('Unable to load businesses.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleConfirm() {
    if (!confirmTarget) return;
    const { business, action } = confirmTarget;
    setBusyId(business.id);
    try {
      if (action === 'deactivate') {
        await developerApi.deactivateBusiness(business.id);
        showToast(`${business.name} deactivated — its users can no longer log in.`);
      } else if (action === 'reactivate') {
        await developerApi.reactivateBusiness(business.id);
        showToast(`${business.name} reactivated.`);
      } else {
        await developerApi.deleteBusiness(business.id);
        showToast(`${business.name} permanently deleted.`);
      }
      setConfirmTarget(null);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to complete that action.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <LoadingSpinner label="Loading businesses..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-heading">Businesses</h1>
        <p className="mt-1 text-sm text-slate-500">Every tenant on the platform, with owner and activity counts.</p>
      </div>

      <div className="card overflow-hidden">
        {businesses.length === 0 ? (
          <EmptyState icon={<Building2 className="h-6 w-6" />} title="No businesses yet" />
        ) : (
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Business</th>
                <th className="px-4 py-2">Owner</th>
                <th className="px-4 py-2">Users</th>
                <th className="px-4 py-2">Leads</th>
                <th className="px-4 py-2">Campaigns</th>
                <th className="px-4 py-2">Created</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {businesses.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-900">
                    <Link to={`/developer/businesses/${b.id}`} className="text-brand-700 hover:underline">{b.name}</Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{b.owner_name ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{b.user_count}</td>
                  <td className="px-4 py-2 text-slate-600">{b.lead_count}</td>
                  <td className="px-4 py-2 text-slate-600">{b.campaign_count}</td>
                  <td className="px-4 py-2 text-slate-500">{new Date(b.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${b.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {b.is_active ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        className="text-xs font-medium text-slate-500 hover:text-slate-700"
                        disabled={busyId === b.id}
                        onClick={() => setConfirmTarget({ business: b, action: b.is_active ? 'deactivate' : 'reactivate' })}
                      >
                        {b.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                      <button
                        className="text-xs font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:text-slate-300"
                        disabled={busyId === b.id || b.is_active}
                        title={b.is_active ? 'Deactivate this business before deleting it' : undefined}
                        onClick={() => setConfirmTarget({ business: b, action: 'delete' })}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        title={
          confirmTarget?.action === 'deactivate' ? 'Deactivate this business?'
          : confirmTarget?.action === 'reactivate' ? 'Reactivate this business?'
          : 'Permanently delete this business?'
        }
        description={
          confirmTarget?.action === 'deactivate' ? `${confirmTarget.business.name} and all of its users will immediately lose the ability to log in. This can be undone by reactivating.`
          : confirmTarget?.action === 'reactivate' ? `${confirmTarget?.business.name}'s users will regain the ability to log in.`
          : `${confirmTarget?.business.name} and all of its data — users, leads, outreach campaigns and messages — will be permanently deleted. This cannot be undone.`
        }
        confirmLabel={
          confirmTarget?.action === 'deactivate' ? 'Deactivate'
          : confirmTarget?.action === 'reactivate' ? 'Reactivate'
          : 'Delete permanently'
        }
        danger={confirmTarget?.action !== 'reactivate'}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
