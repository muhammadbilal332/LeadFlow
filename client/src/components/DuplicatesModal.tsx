import React, { useEffect, useState } from 'react';
import { X, GitMerge } from 'lucide-react';
import * as leadsApi from '../services/leadsApi';
import { Lead } from '../types';
import { useToast } from '../hooks/useToast';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';

interface DuplicatesModalProps {
  onClose: () => void;
  onMerged: () => void;
}

export default function DuplicatesModal({ onClose, onMerged }: DuplicatesModalProps): React.ReactElement {
  const { showToast } = useToast();
  const [duplicates, setDuplicates] = useState<Array<Lead & { duplicate_of_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await leadsApi.listDuplicates();
      setDuplicates(res.duplicates);
    } catch {
      showToast('Unable to load possible duplicates.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleMerge(lead: Lead) {
    if (!lead.duplicate_of_lead_id) return;
    setMerging(lead.id);
    try {
      await leadsApi.mergeLeads(lead.id, lead.duplicate_of_lead_id);
      showToast(`Merged "${lead.name}" into the original lead.`);
      onMerged();
      load();
    } catch {
      showToast('Unable to merge leads.', 'error');
    } finally {
      setMerging(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="duplicates-title">
      <div className="card max-h-[80vh] w-full max-w-2xl overflow-y-auto p-5">
        <div className="flex items-center justify-between">
          <h2 id="duplicates-title" className="text-base font-semibold text-slate-900">Possible duplicate leads</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Flagged by matching email or phone against an existing lead. Merging moves notes, activities, and open follow-ups onto the original and keeps this record for audit history.
        </p>

        <div className="mt-4">
          {loading ? (
            <LoadingSpinner label="Checking for duplicates..." />
          ) : duplicates.length === 0 ? (
            <EmptyState title="No duplicates pending review" description="New possible duplicates will show up here as leads come in." />
          ) : (
            <ul className="space-y-3">
              {duplicates.map((lead) => (
                <li key={lead.id} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                  <p className="font-medium text-slate-900">{lead.name} <span className="font-normal text-slate-500">({lead.email || lead.phone})</span></p>
                  <p className="text-xs text-slate-600">Possible duplicate of <span className="font-medium">{lead.duplicate_of_name}</span></p>
                  <div className="mt-2 flex gap-2">
                    <button className="btn-primary" disabled={merging === lead.id} onClick={() => handleMerge(lead)}>
                      <GitMerge className="h-3.5 w-3.5" /> {merging === lead.id ? 'Merging...' : 'Merge into original'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
