import React, { useEffect, useState } from 'react';
import { Plus, Copy, Trash2, Key } from 'lucide-react';
import * as integrationsApi from '../services/integrationsApi';
import { ApiKey } from '../types';
import SettingsTabs from '../components/SettingsTabs';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../hooks/useToast';

export default function SettingsApiKeysPage(): React.ReactElement {
  const { showToast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await integrationsApi.listApiKeys();
      setKeys(res.apiKeys);
    } catch {
      setError('Unable to load API keys.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await integrationsApi.createApiKey(name);
      setNewKey(res.key);
      setName('');
      setShowForm(false);
      load();
    } catch {
      showToast('Unable to create API key.', 'error');
    }
  }

  async function copyKey(key: string) {
    try {
      await navigator.clipboard.writeText(key);
      showToast('API key copied to clipboard.');
    } catch {
      showToast('Unable to copy.', 'error');
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return;
    try {
      await integrationsApi.revokeApiKey(revokeTarget.id);
      showToast('API key revoked.');
      setRevokeTarget(null);
      load();
    } catch {
      showToast('Unable to revoke key.', 'error');
    }
  }

  return (
    <div className="space-y-4">
      <SettingsTabs />
      <PageHeader
        eyebrow="Settings"
        title="API keys"
        description="For server-to-server integrations that call the SellerClutch API directly."
        actions={
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" /> New key
          </button>
        }
      />

      {showForm && (
        <form onSubmit={handleCreate} className="card flex flex-wrap gap-2 p-4">
          <input required className="input max-w-xs" placeholder="Key name (e.g. Zapier)" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="btn-primary">Create</button>
          <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
        </form>
      )}

      {newKey && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-900">Copy this key now — it will not be shown again.</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="break-all rounded bg-white px-2 py-1 text-xs">{newKey}</code>
            <button className="btn-secondary shrink-0" onClick={() => copyKey(newKey)}>
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading API keys..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : keys.length === 0 ? (
          <EmptyState icon={<Key className="h-6 w-6" />} title="No API keys yet" description="Create one to let an external service create leads via the API." />
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Key</th>
                <th className="px-4 py-3">Last used</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {keys.map((k) => (
                <tr key={k.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{k.name}</td>
                  <td className="px-4 py-3 text-slate-500"><code>lf_{k.key_prefix}&hellip;</code></td>
                  <td className="px-4 py-3 text-slate-500">{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${k.revoked_at ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>
                      {k.revoked_at ? 'Revoked' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {!k.revoked_at && (
                      <button className="text-slate-400 hover:text-red-600" onClick={() => setRevokeTarget(k)} aria-label={`Revoke ${k.name}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title="Revoke this API key?"
        description={`"${revokeTarget?.name}" will immediately stop working. This cannot be undone.`}
        confirmLabel="Revoke"
        danger
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  );
}
