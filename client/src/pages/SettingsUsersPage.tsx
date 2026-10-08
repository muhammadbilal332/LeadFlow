import React, { useEffect, useState } from 'react';
import { Plus, UserCheck, UserX } from 'lucide-react';
import { listUsers, createUser, updateUser } from '../services/usersApi';
import { User } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import { useToast } from '../hooks/useToast';
import { ApiError } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import SettingsTabs from '../components/SettingsTabs';
import PageHeader from '../components/PageHeader';

export default function SettingsUsersPage(): React.ReactElement {
  const { showToast } = useToast();
  const { user } = useAuth();
  // Managers can see the team but only owners add or deactivate members.
  const canManageMembers = user?.role === 'owner';
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await listUsers();
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await createUser({ ...form, role: 'sales' });
      showToast('Sales user created.');
      setForm({ name: '', email: '', password: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to create user.');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(user: User) {
    try {
      await updateUser(user.id, { isActive: !user.is_active });
      showToast(`${user.name} ${user.is_active ? 'deactivated' : 'activated'}.`);
      load();
    } catch {
      showToast('Unable to update user.', 'error');
    }
  }

  return (
    <div className="space-y-4">
      <SettingsTabs />
      <PageHeader
        eyebrow="Settings"
        title="Team members"
        description="Manage sales users who can access sellerClutch."
        actions={
          canManageMembers && (
            <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
              <Plus className="h-4 w-4" /> Add Sales User
            </button>
          )
        }
      />

      {showForm && (
        <div className="card p-4">
          {formError && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="new-name" className="label">Name</label>
              <input id="new-name" required className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="new-email" className="label">Email</label>
              <input id="new-email" type="email" required className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="new-password" className="label">Temporary password</label>
              <input id="new-password" type="password" required minLength={8} className="input" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="sm:col-span-3 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary">{submitting ? 'Creating...' : 'Create user'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading users..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{u.role}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {canManageMembers && u.role !== 'owner' && (
                      <button className="btn-secondary" onClick={() => toggleActive(u)}>
                        {u.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
