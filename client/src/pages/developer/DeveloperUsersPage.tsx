import React, { useEffect, useState } from 'react';
import { Users2 } from 'lucide-react';
import * as developerApi from '../../services/developerApi';
import { PlatformUser } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useToast } from '../../hooks/useToast';

const ROLE_COLORS: Record<string, string> = {
  developer: 'bg-indigo-100 text-indigo-700',
  owner: 'bg-blue-100 text-blue-700',
  sales: 'bg-slate-100 text-slate-600',
};

export default function DeveloperUsersPage(): React.ReactElement {
  const { showToast } = useToast();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ user: PlatformUser; action: 'enable' | 'disable' } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await developerApi.listUsers();
      setUsers(res.users);
    } catch {
      setError('Unable to load users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRoleChange(user: PlatformUser, role: 'owner' | 'sales') {
    setBusyId(user.id);
    try {
      await developerApi.changeUserRole(user.id, role);
      showToast(`${user.name}'s role changed to ${role}.`);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to change role.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmStatus() {
    if (!confirmTarget) return;
    setBusyId(confirmTarget.user.id);
    try {
      await developerApi.setUserStatus(confirmTarget.user.id, confirmTarget.action === 'enable');
      showToast(`${confirmTarget.user.name} ${confirmTarget.action === 'enable' ? 'enabled' : 'disabled'}.`);
      setConfirmTarget(null);
      load();
    } catch {
      showToast('Unable to update account status.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <LoadingSpinner label="Loading users..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-heading">Users</h1>
        <p className="mt-1 text-sm text-slate-500">Every user account across every business. Sensitive actions are audited.</p>
      </div>

      <div className="card overflow-hidden">
        {users.length === 0 ? (
          <EmptyState icon={<Users2 className="h-6 w-6" />} title="No users yet" />
        ) : (
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Business</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Created</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-900">{u.name}</td>
                  <td className="px-4 py-2 text-slate-600">{u.email}</td>
                  <td className="px-4 py-2 text-slate-600">{u.business_name}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role] ?? 'bg-slate-100 text-slate-600'}`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {u.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2">
                    {u.role !== 'developer' && (
                      <div className="flex items-center justify-end gap-2">
                        <select
                          className="rounded-md border border-slate-300 px-1.5 py-1 text-xs"
                          value={u.role}
                          disabled={busyId === u.id}
                          onChange={(e) => handleRoleChange(u, e.target.value as 'owner' | 'sales')}
                        >
                          <option value="owner">owner</option>
                          <option value="sales">sales</option>
                        </select>
                        <button
                          className="text-xs font-medium text-slate-500 hover:text-red-600"
                          disabled={busyId === u.id}
                          onClick={() => setConfirmTarget({ user: u, action: u.is_active ? 'disable' : 'enable' })}
                        >
                          {u.is_active ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        title={confirmTarget?.action === 'disable' ? 'Disable this account?' : 'Enable this account?'}
        description={confirmTarget?.action === 'disable' ? `${confirmTarget.user.name} will no longer be able to log in.` : `${confirmTarget?.user.name} will regain access.`}
        confirmLabel={confirmTarget?.action === 'disable' ? 'Disable' : 'Enable'}
        danger={confirmTarget?.action === 'disable'}
        onConfirm={handleConfirmStatus}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
