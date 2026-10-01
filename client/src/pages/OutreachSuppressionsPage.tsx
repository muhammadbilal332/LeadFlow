import React, { useEffect, useState } from 'react';
import { ShieldOff, Plus, Trash2 } from 'lucide-react';
import * as outreachApi from '../services/outreachApi';
import { Suppression } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import OutreachTabs from '../components/OutreachTabs';
import { useToast } from '../hooks/useToast';

export default function OutreachSuppressionsPage(): React.ReactElement {
  const { showToast } = useToast();
  const [suppressions, setSuppressions] = useState<Suppression[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await outreachApi.listSuppressions();
      setSuppressions(res.suppressions);
    } catch {
      setError('Unable to load the suppression list.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    try {
      await outreachApi.addSuppression(email);
      showToast('Added to suppression list — this address can never receive an outreach email.');
      setEmail('');
      load();
    } catch {
      showToast('Unable to add suppression.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(emailToRemove: string) {
    try {
      await outreachApi.removeSuppression(emailToRemove);
      showToast('Removed from suppression list.');
      load();
    } catch {
      showToast('Unable to remove suppression.', 'error');
    }
  }

  if (loading) return <LoadingSpinner label="Loading suppression list..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <OutreachTabs />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Suppression list</h1>
        <p className="text-sm text-slate-500">Every send checks this list first. A suppressed address can never receive another outreach email from this business.</p>
      </div>

      <form onSubmit={handleAdd} className="card flex flex-wrap gap-2 p-4">
        <input className="input flex-1" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" className="btn-primary" disabled={saving}>
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>

      <div className="card overflow-hidden">
        {suppressions.length === 0 ? (
          <EmptyState icon={<ShieldOff className="h-6 w-6" />} title="No suppressed addresses" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {suppressions.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{s.normalized_email}</p>
                  <p className="text-xs text-slate-500">{s.reason} &middot; {new Date(s.created_at).toLocaleDateString()}</p>
                </div>
                <button className="text-slate-400 hover:text-red-500" onClick={() => handleRemove(s.normalized_email)} aria-label="Remove suppression">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
