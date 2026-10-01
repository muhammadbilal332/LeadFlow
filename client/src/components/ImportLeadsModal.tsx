import React, { useState } from 'react';
import { Upload, X } from 'lucide-react';
import { importLeads } from '../services/leadsApi';

interface ImportLeadsModalProps {
  onClose: () => void;
  onImported: () => void;
}

interface ImportResult {
  imported: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

export default function ImportLeadsModal({ onClose, onImported }: ImportLeadsModalProps): React.ReactElement {
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ''));
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!csvText.trim()) {
      setError('Choose a CSV file first.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await importLeads(csvText);
      setResult(res);
      if (res.imported > 0) onImported();
    } catch {
      setError('Import failed. Please check the file and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <div className="card w-full max-w-lg p-5">
        <div className="flex items-center justify-between">
          <h2 id="import-title" className="text-base font-semibold text-slate-900">Import Leads</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          Upload a CSV with columns: name, company, email, phone, source, industry, interested_in, budget, timeline, description.
        </p>
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Bulk-imported leads skip your lead routing and automation rules (Settings → Lead routing / Automations), so they won't be auto-assigned or trigger automated follow-ups — this avoids a notification storm when importing many rows at once. Assign and route them manually, or add leads one at a time if you want rules to apply.
        </p>

        <div className="mt-4">
          <label className="label" htmlFor="csv-file">CSV file</label>
          <input id="csv-file" type="file" accept=".csv,text/csv" onChange={handleFile} className="input" />
          {fileName && <p className="mt-1 text-xs text-slate-500">Selected: {fileName}</p>}
        </div>

        {error && <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        {result && (
          <div className="mt-4 space-y-2 rounded-md border border-slate-200 p-3 text-sm">
            <p className="font-medium text-slate-900">
              Imported {result.imported} leads, {result.failed} failed.
            </p>
            {result.errors.length > 0 && (
              <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-red-600">
                {result.errors.map((e, i) => (
                  <li key={i}>Row {e.row}: {e.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button className="btn-primary" onClick={handleImport} disabled={submitting}>
              <Upload className="h-4 w-4" />
              {submitting ? 'Importing...' : 'Import'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
