import React, { useEffect, useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import * as routingApi from '../services/routingApi';
import * as usersApi from '../services/usersApi';
import { RoutingRule, SlaSettings, User } from '../types';
import SettingsTabs from '../components/SettingsTabs';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../hooks/useToast';

const FIELD_LABELS: Record<string, string> = { source: 'Source', industry: 'Industry', score: 'Score', always: 'Always (default)' };

export default function SettingsRoutingPage(): React.ReactElement {
  const { showToast } = useToast();
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sla, setSla] = useState<SlaSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RoutingRule | null>(null);
  const [savingSla, setSavingSla] = useState(false);

  const [form, setForm] = useState({
    name: '', priority: 0, field: 'source' as RoutingRule['field'], operator: 'equals' as RoutingRule['operator'],
    value: '', assignmentType: 'user' as RoutingRule['assignment_type'], assignUserId: '',
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [rulesRes, usersRes, slaRes] = await Promise.all([routingApi.listRoutingRules(), usersApi.listUsers(), routingApi.getSlaSettings()]);
      setRules(rulesRes.rules);
      setUsers(usersRes.users);
      setSla(slaRes.settings);
    } catch {
      setError('Unable to load routing settings.');
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
      await routingApi.createRoutingRule({
        name: form.name,
        priority: Number(form.priority),
        field: form.field,
        operator: form.operator,
        value: form.field === 'always' ? null : form.value,
        assignmentType: form.assignmentType,
        assignUserId: form.assignmentType === 'user' ? form.assignUserId : null,
      });
      showToast('Routing rule created.');
      setShowForm(false);
      setForm({ name: '', priority: 0, field: 'source', operator: 'equals', value: '', assignmentType: 'user', assignUserId: '' });
      load();
    } catch {
      showToast('Unable to create routing rule.', 'error');
    }
  }

  async function toggleActive(rule: RoutingRule) {
    try {
      await routingApi.updateRoutingRule(rule.id, { isActive: !rule.is_active });
      load();
    } catch {
      showToast('Unable to update rule.', 'error');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await routingApi.deleteRoutingRule(deleteTarget.id);
      showToast('Routing rule deleted.');
      setDeleteTarget(null);
      load();
    } catch {
      showToast('Unable to delete rule.', 'error');
    }
  }

  async function handleSaveSla(e: React.FormEvent) {
    e.preventDefault();
    if (!sla) return;
    setSavingSla(true);
    try {
      const res = await routingApi.updateSlaSettings({
        hotMinutes: Number(sla.hot_minutes), highMinutes: Number(sla.high_minutes),
        mediumMinutes: Number(sla.medium_minutes), lowMinutes: Number(sla.low_minutes),
      });
      setSla(res.settings);
      showToast('Response time targets updated.');
    } catch {
      showToast('Unable to update targets.', 'error');
    } finally {
      setSavingSla(false);
    }
  }

  const userName = (id: string | null) => users.find((u) => u.id === id)?.name ?? 'Unknown';

  return (
    <div className="space-y-4">
      <SettingsTabs />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Lead routing</h1>
        <p className="text-sm text-slate-500">Automatically assign new leads and set response-time targets.</p>
      </div>

      {sla && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900">Response time targets (SLA)</h2>
          <p className="mt-1 text-sm text-slate-500">How soon a new lead should be contacted, by Lead Score priority. Used for the follow-up auto-scheduled on every new lead.</p>
          <form onSubmit={handleSaveSla} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([['hot_minutes', 'Hot'], ['high_minutes', 'High'], ['medium_minutes', 'Medium'], ['low_minutes', 'Low']] as const).map(([key, label]) => (
              <div key={key}>
                <label className="label" htmlFor={key}>{label} (minutes)</label>
                <input
                  id={key}
                  type="number"
                  min={1}
                  className="input"
                  value={sla[key]}
                  onChange={(e) => setSla((s) => (s ? { ...s, [key]: Number(e.target.value) } : s))}
                />
              </div>
            ))}
            <div className="col-span-2 sm:col-span-4">
              <button type="submit" disabled={savingSla} className="btn-primary">{savingSla ? 'Saving...' : 'Save targets'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Assignment rules</h2>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> New rule
        </button>
      </div>
      <p className="-mt-2 text-xs text-slate-500">Rules are evaluated in priority order (lowest number first); the first match wins.</p>

      {showForm && (
        <div className="card p-4">
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input required className="input" placeholder="Rule name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <input type="number" className="input" placeholder="Priority (0 = first)" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))} />
            <select className="select" value={form.field} onChange={(e) => setForm((f) => ({ ...f, field: e.target.value as RoutingRule['field'] }))}>
              <option value="source">If Source</option>
              <option value="industry">If Industry</option>
              <option value="score">If Score</option>
              <option value="always">Always (default)</option>
            </select>
            {form.field !== 'always' && (
              <>
                <select className="select" value={form.operator} onChange={(e) => setForm((f) => ({ ...f, operator: e.target.value as RoutingRule['operator'] }))}>
                  <option value="equals">equals</option>
                  {form.field === 'score' && <option value="gte">is at least</option>}
                  {form.field === 'score' && <option value="lte">is at most</option>}
                </select>
                <input required className="input" placeholder="Value (e.g. Instagram or 85)" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
              </>
            )}
            <select className="select" value={form.assignmentType} onChange={(e) => setForm((f) => ({ ...f, assignmentType: e.target.value as RoutingRule['assignment_type'] }))}>
              <option value="user">Assign to specific person</option>
              <option value="round_robin">Round robin (sales team)</option>
              <option value="owner">Assign to owner</option>
            </select>
            {form.assignmentType === 'user' && (
              <select required className="select" value={form.assignUserId} onChange={(e) => setForm((f) => ({ ...f, assignUserId: e.target.value }))}>
                <option value="">Select person...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            )}
            <div className="sm:col-span-3 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Create rule</button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading rules..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : rules.length === 0 ? (
          <EmptyState title="No routing rules yet" description="New leads will remain unassigned until you add a rule, or a salesperson claims them manually." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rules.map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-slate-300" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{rule.name}</p>
                    <p className="text-xs text-slate-500">
                      Priority {rule.priority} &middot; {rule.field === 'always' ? 'Always' : `${FIELD_LABELS[rule.field]} ${rule.operator} ${rule.value}`} &rarr;{' '}
                      {rule.assignment_type === 'user' ? userName(rule.assign_user_id) : rule.assignment_type === 'round_robin' ? 'Round robin' : 'Owner'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(rule)}
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${rule.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {rule.is_active ? 'Active' : 'Disabled'}
                  </button>
                  <button onClick={() => setDeleteTarget(rule)} className="text-slate-400 hover:text-red-600" aria-label={`Delete ${rule.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this rule?"
        description={`"${deleteTarget?.name}" will no longer affect lead assignment.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
