import React, { useEffect, useState } from 'react';
import { Plus, Layers, Trash2 } from 'lucide-react';
import * as outreachApi from '../services/outreachApi';
import { OutreachSequence, SequenceStep } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import OutreachTabs from '../components/OutreachTabs';
import { useToast } from '../hooks/useToast';
import PageHeader from '../components/PageHeader';

const blankStep = (order: number): SequenceStep => ({ step_order: order, delay_days: order === 1 ? 0 : 3, subject_template: '', body_template: '', ai_personalize: true, is_enabled: true });

export default function OutreachSequencesPage(): React.ReactElement {
  const { showToast } = useToast();
  const [sequences, setSequences] = useState<OutreachSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<SequenceStep[]>([blankStep(1)]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OutreachSequence | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await outreachApi.listSequences();
      setSequences(res.sequences);
    } catch {
      setError('Unable to load sequences.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function addStep() {
    setSteps((prev) => [...prev, blankStep(prev.length + 1)]);
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_order: i + 1 })));
  }

  function updateStep(index: number, patch: Partial<SequenceStep>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || steps.some((s) => !s.subject_template.trim())) {
      showToast('Every step needs a subject line.', 'error');
      return;
    }
    setSaving(true);
    try {
      await outreachApi.createSequence({ name, steps });
      showToast('Sequence created.');
      setName('');
      setSteps([blankStep(1)]);
      setShowForm(false);
      load();
    } catch {
      showToast('Unable to create sequence.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await outreachApi.deleteSequence(deleteTarget.id);
      showToast('Sequence deleted.');
      setDeleteTarget(null);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete sequence.', 'error');
    }
  }

  if (loading) return <LoadingSpinner label="Loading sequences..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <OutreachTabs />
      <PageHeader
        eyebrow="Outreach"
        title="Sequences"
        description="A sequence is a set of follow-up emails with a delay between each step."
        actions={
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" /> New sequence
          </button>
        }
      />

      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-3 p-4">
          <input className="input" placeholder="Sequence name *" value={name} onChange={(e) => setName(e.target.value)} required />
          {steps.map((step, i) => (
            <div key={i} className="rounded-md border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase text-slate-500">Step {step.step_order} {i > 0 && `— sent ${step.delay_days} day(s) after the previous step`}</p>
                {steps.length > 1 && (
                  <button type="button" className="text-slate-400 hover:text-red-500" onClick={() => removeStep(i)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  className="input sm:col-span-2"
                  placeholder="Subject line hint (AI personalizes the final subject)"
                  value={step.subject_template}
                  onChange={(e) => updateStep(i, { subject_template: e.target.value })}
                  required
                />
                {i > 0 && (
                  <input
                    type="number"
                    min={0}
                    className="input"
                    placeholder="Delay (days)"
                    value={step.delay_days}
                    onChange={(e) => updateStep(i, { delay_days: Number(e.target.value) })}
                  />
                )}
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={addStep}>
              <Plus className="h-4 w-4" /> Add follow-up step
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save sequence'}</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {sequences.length === 0 ? (
          <EmptyState icon={<Layers className="h-6 w-6" />} title="No sequences yet" description="Create a sequence to define what emails get sent and when." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {sequences.map((seq) => (
              <li key={seq.id} className="flex items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900">{seq.name}</p>
                  <p className="text-xs text-slate-500">{seq.steps.length} step(s): {seq.steps.map((s) => `#${s.step_order}${s.step_order > 1 ? ` (+${s.delay_days}d)` : ''}`).join(', ')}</p>
                </div>
                <button className="text-slate-400 hover:text-red-500" aria-label="Delete sequence" onClick={() => setDeleteTarget(seq)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this sequence?"
        description={`This removes "${deleteTarget?.name ?? ''}" and its steps. A sequence in use by an active campaign can't be deleted until that campaign is cancelled or deleted.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
