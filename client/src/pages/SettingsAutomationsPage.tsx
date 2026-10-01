import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import * as automationApi from '../services/automationApi';
import * as usersApi from '../services/usersApi';
import { AutomationRule, User, FOLLOW_UP_TYPES } from '../types';
import SettingsTabs from '../components/SettingsTabs';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../hooks/useToast';

type ActionType = 'assign_user' | 'create_followup' | 'notify';

export default function SettingsAutomationsPage(): React.ReactElement {
  const { showToast } = useToast();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AutomationRule | null>(null);

  const [name, setName] = useState('');
  const [conditionField, setConditionField] = useState<'score' | 'source' | 'industry'>('score');
  const [conditionOperator, setConditionOperator] = useState<'equals' | 'gte' | 'lte'>('gte');
  const [conditionValue, setConditionValue] = useState('85');
  const [actionType, setActionType] = useState<ActionType>('notify');
  const [actionUserId, setActionUserId] = useState('');
  const [followUpType, setFollowUpType] = useState('Call');
  const [followUpMinutes, setFollowUpMinutes] = useState(15);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [rulesRes, usersRes] = await Promise.all([automationApi.listAutomationRules(), usersApi.listUsers()]);
      setRules(rulesRes.rules);
      setUsers(usersRes.users);
    } catch {
      setError('Unable to load automation rules.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const action =
      actionType === 'assign_user' ? { type: 'assign_user' as const, userId: actionUserId }
      : actionType === 'create_followup' ? { type: 'create_followup' as const, followUpType: followUpType as (typeof FOLLOW_UP_TYPES)[number], minutes: followUpMinutes }
      : { type: 'notify' as const, userId: actionUserId || undefined };

    try {
      await automationApi.createAutomationRule({
        name,
        conditions: [{ field: conditionField, operator: conditionOperator, value: conditionValue }],
        actions: [action],
      });
      showToast('Automation created.');
      setShowForm(false);
      setName('');
      load();
    } catch {
      showToast('Unable to create automation.', 'error');
    }
  }

  async function toggleActive(rule: AutomationRule) {
    try {
      await automationApi.updateAutomationRule(rule.id, { isActive: !rule.is_active });
      load();
    } catch {
      showToast('Unable to update automation.', 'error');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await automationApi.deleteAutomationRule(deleteTarget.id);
      showToast('Automation deleted.');
      setDeleteTarget(null);
      load();
    } catch {
      showToast('Unable to delete automation.', 'error');
    }
  }

  function describeAction(rule: AutomationRule): string {
    const action = rule.actions[0];
    if (!action) return 'No action';
    if (action.type === 'assign_user') return `Assign to ${users.find((u) => u.id === action.userId)?.name ?? 'user'}`;
    if (action.type === 'create_followup') return `Create a ${action.followUpType} follow-up within ${action.minutes} min`;
    return `Notify ${action.userId ? users.find((u) => u.id === action.userId)?.name ?? 'user' : 'owner'}`;
  }

  function describeConditions(rule: AutomationRule): string {
    return rule.conditions.map((c) => `${c.field} ${c.operator} ${c.value}`).join(' AND ') || 'Always';
  }

  return (
    <div className="space-y-4">
      <SettingsTabs />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Automations</h1>
          <p className="text-sm text-slate-500">WHEN a lead is created, IF conditions match, THEN run an action.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> New automation
        </button>
      </div>

      {showForm && (
        <div className="card p-4">
          <form onSubmit={handleCreate} className="space-y-3">
            <input required className="input" placeholder="Automation name (e.g. Escalate hot leads)" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <select className="select" value={conditionField} onChange={(e) => setConditionField(e.target.value as typeof conditionField)}>
                <option value="score">IF Score</option>
                <option value="source">IF Source</option>
                <option value="industry">IF Industry</option>
              </select>
              <select className="select" value={conditionOperator} onChange={(e) => setConditionOperator(e.target.value as typeof conditionOperator)}>
                {conditionField === 'score' ? (
                  <>
                    <option value="gte">is at least</option>
                    <option value="lte">is at most</option>
                  </>
                ) : (
                  <option value="equals">equals</option>
                )}
              </select>
              <input required className="input" placeholder="Value" value={conditionValue} onChange={(e) => setConditionValue(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <select className="select" value={actionType} onChange={(e) => setActionType(e.target.value as ActionType)}>
                <option value="notify">THEN Notify</option>
                <option value="assign_user">THEN Assign to</option>
                <option value="create_followup">THEN Create follow-up</option>
              </select>
              {(actionType === 'assign_user' || actionType === 'notify') && (
                <select className="select" value={actionUserId} onChange={(e) => setActionUserId(e.target.value)} required={actionType === 'assign_user'}>
                  <option value="">{actionType === 'notify' ? 'Owner (default)' : 'Select person...'}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              )}
              {actionType === 'create_followup' && (
                <>
                  <select className="select" value={followUpType} onChange={(e) => setFollowUpType(e.target.value)}>
                    {FOLLOW_UP_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <input type="number" min={1} className="input" placeholder="Minutes" value={followUpMinutes} onChange={(e) => setFollowUpMinutes(Number(e.target.value))} />
                </>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Create automation</button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading automations..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : rules.length === 0 ? (
          <EmptyState title="No automations yet" description="Add one to automatically notify, assign, or schedule follow-ups when a lead matches conditions you define." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rules.map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{rule.name}</p>
                  <p className="text-xs text-slate-500">IF {describeConditions(rule)} &rarr; {describeAction(rule)}</p>
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
        title="Delete this automation?"
        description={`"${deleteTarget?.name}" will stop running.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
