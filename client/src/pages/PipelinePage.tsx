import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPipeline } from '../services/dashboardApi';
import { updateLead } from '../services/leadsApi';
import { PipelineColumn, LeadStatus, LEAD_STATUSES, Lead } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import ScoreBadge from '../components/ScoreBadge';
import { useToast } from '../hooks/useToast';

function currency(value: string | null): string {
  if (!value) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value));
}

const COLUMN_ACCENT: Record<LeadStatus, string> = {
  New: 'border-t-slate-400',
  Contacted: 'border-t-blue-400',
  Qualified: 'border-t-indigo-400',
  Proposal: 'border-t-amber-400',
  Negotiation: 'border-t-orange-400',
  Won: 'border-t-emerald-400',
  Lost: 'border-t-red-400',
};

export default function PipelinePage(): React.ReactElement {
  const { showToast } = useToast();
  const [columns, setColumns] = useState<PipelineColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragLeadId, setDragLeadId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<LeadStatus | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await getPipeline();
      setColumns(res.columns);
    } catch {
      setError('Unable to load the pipeline.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function moveLead(lead: Lead, newStatus: LeadStatus) {
    if (lead.status === newStatus) return;
    const prevColumns = columns;
    setColumns((cols) =>
      cols.map((col) => {
        if (col.status === lead.status) return { ...col, leads: col.leads.filter((l) => l.id !== lead.id) };
        if (col.status === newStatus) return { ...col, leads: [{ ...lead, status: newStatus }, ...col.leads] };
        return col;
      })
    );
    try {
      await updateLead(lead.id, { status: newStatus });
      showToast(`${lead.name} moved to ${newStatus}.`);
    } catch {
      setColumns(prevColumns);
      showToast('Unable to update lead status.', 'error');
    }
  }

  function handleDrop(status: LeadStatus) {
    setDragOverStatus(null);
    if (!dragLeadId) return;
    const lead = columns.flatMap((c) => c.leads).find((l) => l.id === dragLeadId);
    setDragLeadId(null);
    if (lead) moveLead(lead, status);
  }

  if (loading) return <LoadingSpinner label="Loading pipeline..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Pipeline</h1>
        <p className="text-sm text-slate-500">Drag a card to a new stage, or use the dropdown on each card.</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <div
            key={col.status}
            className={`flex w-72 shrink-0 flex-col rounded-lg border-t-4 bg-slate-100/60 ${COLUMN_ACCENT[col.status]}`}
            onDragOver={(e) => { e.preventDefault(); setDragOverStatus(col.status); }}
            onDragLeave={() => setDragOverStatus((s) => (s === col.status ? null : s))}
            onDrop={() => handleDrop(col.status)}
          >
            <div className="flex items-center justify-between px-3 py-2">
              <h2 className="text-sm font-semibold text-slate-700">{col.status}</h2>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">{col.leads.length}</span>
            </div>
            <div className={`flex-1 space-y-2 p-2 ${dragOverStatus === col.status ? 'bg-brand-50/60' : ''}`} style={{ minHeight: 80 }}>
              {col.leads.length === 0 && <p className="px-2 py-4 text-center text-xs text-slate-400">No leads</p>}
              {col.leads.map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={() => setDragLeadId(lead.id)}
                  onDragEnd={() => setDragLeadId(null)}
                  className="card cursor-grab space-y-1.5 p-3 active:cursor-grabbing"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/leads/${lead.id}`} className="text-sm font-medium text-slate-900 hover:text-brand-700 hover:underline">
                      {lead.name}
                    </Link>
                    <ScoreBadge score={lead.score} />
                  </div>
                  <p className="text-xs text-slate-500">{lead.company || 'No company'}</p>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{lead.assigned_user_name || 'Unassigned'}</span>
                    <span>{currency(lead.budget)}</span>
                  </div>
                  <select
                    className="select mt-1 text-xs"
                    value={lead.status}
                    onChange={(e) => moveLead(lead, e.target.value as LeadStatus)}
                    aria-label={`Change status for ${lead.name}`}
                  >
                    {LEAD_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
