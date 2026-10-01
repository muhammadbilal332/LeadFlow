import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Copy, ExternalLink } from 'lucide-react';
import * as formsApi from '../services/formsApi';
import { LeadFormField, FORM_FIELD_TYPES } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { ApiError } from '../lib/api';

function emptyField(): LeadFormField {
  return { name: '', label: '', type: 'text', required: false, placeholder: '', options: null };
}

export default function FormEditorPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formId, setFormId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [thankYouMessage, setThankYouMessage] = useState('Thanks! We will be in touch shortly.');
  const [fields, setFields] = useState<LeadFormField[]>([]);
  const [embed, setEmbed] = useState<{ publicUrl: string; embedCode: string } | null>(null);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const res = await formsApi.getForm(id!);
        setFormId(res.form.id);
        setName(res.form.name);
        setDescription(res.form.description ?? '');
        setThankYouMessage(res.form.thank_you_message);
        setFields(res.form.fields);
        const embedRes = await formsApi.getEmbedInfo(res.form.id);
        setEmbed(embedRes);
      } catch {
        setError('Unable to load this form.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isNew]);

  function updateField(index: number, patch: Partial<LeadFormField>) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function addField() {
    setFields((prev) => [...prev, emptyField()]);
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  function moveField(index: number, direction: -1 | 1) {
    setFields((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const cleanedFields = fields.map((f, i) => ({
      ...f,
      name: f.name.trim() || `field_${i + 1}`,
      label: f.label.trim() || `Field ${i + 1}`,
      options: f.type === 'select' ? (f.options ?? []).filter(Boolean) : null,
      sortOrder: i,
    }));

    try {
      if (isNew) {
        const res = await formsApi.createForm({ name, description: description || null, thankYouMessage, fields: cleanedFields });
        showToast('Form created.');
        navigate(`/forms/${res.form.id}`);
      } else {
        await formsApi.updateForm(formId!, { name, description: description || null, thankYouMessage, fields: cleanedFields });
        showToast('Form saved.');
        const embedRes = await formsApi.getEmbedInfo(formId!);
        setEmbed(embedRes);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save form.');
    } finally {
      setSaving(false);
    }
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied.`);
    } catch {
      showToast('Unable to copy.', 'error');
    }
  }

  if (loading) return <LoadingSpinner label="Loading form..." />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/forms" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to forms
      </Link>

      <div className="card p-6">
        <h1 className="text-xl font-semibold text-slate-900">{isNew ? 'Create a new form' : 'Edit form'}</h1>
        <p className="mt-1 text-sm text-slate-500">Name, email, and phone are always included. Add custom fields below.</p>

        {error && <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSave} className="mt-6 space-y-5">
          <div>
            <label className="label" htmlFor="form-name">Form name</label>
            <input id="form-name" required className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="form-description">Description (shown on the public form)</label>
            <textarea id="form-description" rows={2} className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="form-thanks">Thank-you message</label>
            <textarea id="form-thanks" rows={2} className="input" value={thankYouMessage} onChange={(e) => setThankYouMessage(e.target.value)} />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="label mb-0">Custom fields</p>
              <button type="button" className="btn-secondary" onClick={addField}>
                <Plus className="h-3.5 w-3.5" /> Add field
              </button>
            </div>
            <div className="mt-2 space-y-3">
              {fields.length === 0 && <p className="text-sm text-slate-500">No custom fields yet — the form will just collect name, email, and phone.</p>}
              {fields.map((field, index) => (
                <div key={index} className="rounded-md border border-slate-200 p-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      className="input"
                      placeholder="Internal name (e.g. budget)"
                      value={field.name}
                      onChange={(e) => updateField(index, { name: e.target.value })}
                    />
                    <input
                      className="input"
                      placeholder="Label shown to visitors"
                      value={field.label}
                      onChange={(e) => updateField(index, { label: e.target.value })}
                    />
                    <select className="select" value={field.type} onChange={(e) => updateField(index, { type: e.target.value as LeadFormField['type'] })}>
                      {FORM_FIELD_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <input
                      className="input"
                      placeholder="Placeholder (optional)"
                      value={field.placeholder ?? ''}
                      onChange={(e) => updateField(index, { placeholder: e.target.value })}
                    />
                    {field.type === 'select' && (
                      <input
                        className="input sm:col-span-2"
                        placeholder="Options, comma separated"
                        value={(field.options ?? []).join(', ')}
                        onChange={(e) => updateField(index, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                      />
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" checked={field.required} onChange={(e) => updateField(index, { required: e.target.checked })} />
                      Required
                    </label>
                    <div className="flex gap-1">
                      <button type="button" className="btn-secondary" onClick={() => moveField(index, -1)} disabled={index === 0}>&uarr;</button>
                      <button type="button" className="btn-secondary" onClick={() => moveField(index, 1)} disabled={index === fields.length - 1}>&darr;</button>
                      <button type="button" className="text-slate-400 hover:text-red-600" onClick={() => removeField(index)} aria-label="Remove field">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Link to="/forms" className="btn-secondary">Cancel</Link>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : isNew ? 'Create form' : 'Save changes'}</button>
          </div>
        </form>
      </div>

      {embed && (
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900">Share this form</h2>
          <div className="mt-3 space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">Public URL</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <code className="rounded bg-slate-100 px-2 py-1 text-xs">{embed.publicUrl}</code>
                <button className="btn-secondary" onClick={() => copy(embed.publicUrl, 'Link')}><Copy className="h-3.5 w-3.5" /> Copy</button>
                <a href={embed.publicUrl} target="_blank" rel="noreferrer" className="btn-secondary"><ExternalLink className="h-3.5 w-3.5" /> Preview</a>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">Embed code</p>
              <div className="mt-1 flex items-start gap-2">
                <code className="block max-w-full overflow-x-auto whitespace-pre rounded bg-slate-100 px-2 py-1 text-xs">{embed.embedCode}</code>
                <button className="btn-secondary shrink-0" onClick={() => copy(embed.embedCode, 'Embed code')}><Copy className="h-3.5 w-3.5" /> Copy</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
