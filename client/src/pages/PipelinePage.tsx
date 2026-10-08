import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPipeline } from '../services/dashboardApi';
import { updateLead } from '../services/leadsApi';
import { PipelineColumn, LeadStatus, Lead } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import ScoreBadge from '../components/ScoreBadge';
import PageHeader from '../components/PageHeader';
import { useToast } from '../hooks/useToast';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

// One accent per stage, used consistently for the column's dot indicator and
// each card's left accent bar — a quieter, more deliberate treatment than a
// heavy colored top border on every column.
const STAGE_ACCENT: Record<LeadStatus, { dot: string; bar: string }> = {
  New: { dot: 'bg-slate-400', bar: 'border-l-slate-400' },
  Contacted: { dot: 'bg-blue-400', bar: 'border-l-blue-400' },
  Replied: { dot: 'bg-teal-400', bar: 'border-l-teal-400' },
  Qualified: { dot: 'bg-indigo-400', bar: 'border-l-indigo-400' },
  Proposal: { dot: 'bg-amber-400', bar: 'border-l-amber-400' },
  Negotiation: { dot: 'bg-orange-400', bar: 'border-l-orange-400' },
  Won: { dot: 'bg-emerald-400', bar: 'border-l-emerald-400' },
  Lost: { dot: 'bg-red-400', bar: 'border-l-red-400' },
};

export default function PipelinePage(): React.ReactElement {
  const { showToast } = useToast();
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardHeight, setBoardHeight] = useState<number | null>(null);
  const [columns, setColumns] = useState<PipelineColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragLeadId, setDragLeadId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<LeadStatus | null>(null);

  useLayoutEffect(() => {
    function fitToViewport() {
      const top = boardRef.current?.getBoundingClientRect().top ?? 0;
      setBoardHeight(Math.max(320, window.innerHeight - top - 16));
    }
    fitToViewport();
    window.addEventListener('resize', fitToViewport);
    return () => window.removeEventListener('resize', fitToViewport);
  }, [loading]);

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
    <div className="flex h-full flex-col space-y-6">
      <PageHeader
        eyebrow="CRM"
        title="Pipeline"
        description="Drag a card to a new stage, or click a card to open the lead. Click a column header to see all its leads."
      />

      <div
        ref={boardRef}
        className="flex gap-5 overflow-auto pb-4"
        style={{ height: boardHeight ? `${boardHeight}px` : undefined, minHeight: 320 }}
      >
        {columns.map((col) => {
          const accent = STAGE_ACCENT[col.status];
          return (
            <div
              key={col.status}
              className="flex w-80 shrink-0 flex-col rounded-2xl border border-slate-200 bg-slate-50"
              onDragOver={(e) => { e.preventDefault(); setDragOverStatus(col.status); }}
              onDragLeave={() => setDragOverStatus((s) => (s === col.status ? null : s))}
              onDrop={() => handleDrop(col.status)}
            >
              <Link
                to={`/leads?status=${col.status}`}
                title={`View all ${col.status} leads`}
                className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-slate-200 bg-white px-4 py-3.5 hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${accent.dot}`} aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-slate-900">{col.status}</h2>
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{col.leads.length}</span>
              </Link>
              <div className={`flex-1 space-y-2.5 p-3 ${dragOverStatus === col.status ? 'bg-brand-50/60' : ''}`} style={{ minHeight: 80 }}>
                {col.leads.length === 0 && <p className="px-2 py-6 text-center text-xs text-slate-400">No leads</p>}
                {col.leads.map((lead) => (
                  <Link
                    key={lead.id}
                    to={`/leads/${lead.id}`}
                    draggable
                    onDragStart={() => setDragLeadId(lead.id)}
                    onDragEnd={() => setDragLeadId(null)}
                    className={`block cursor-grab rounded-xl border border-l-4 border-slate-200 bg-white p-3.5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-card-hover active:cursor-grabbing ${accent.bar}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-900 text-[10px] font-semibold text-white">
                          {initials(lead.name)}
                        </span>
                        <p className="truncate text-sm font-semibold text-slate-900">{lead.name}</p>
                      </div>
                      <ScoreBadge score={lead.score} />
                    </div>
                    <p className="mt-2 truncate text-xs text-slate-500">{lead.company || 'No company'}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">{lead.assigned_user_name || 'Unassigned'}</p>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
