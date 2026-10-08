import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Upload, Download, Users2, AlertTriangle, Trash2 } from 'lucide-react';
import { listLeads, downloadLeadsCsv, listDuplicates, deleteLead } from '../services/leadsApi';
import { listUsers } from '../services/usersApi';
import { Lead, LEAD_STATUSES, User } from '../types';
import StatusBadge from '../components/StatusBadge';
import ScoreBadge from '../components/ScoreBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import ImportLeadsModal from '../components/ImportLeadsModal';
import DuplicatesModal from '../components/DuplicatesModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import PageHeader from '../components/PageHeader';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export default function LeadsPage(): React.ReactElement {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(() => searchParams.get('status') ?? '');
  const [slaStatus] = useState(() => searchParams.get('slaStatus') ?? '');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [minScore, setMinScore] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listLeads({
        page,
        pageSize: 20,
        search: search || undefined,
        status: status || undefined,
        slaStatus: slaStatus || undefined,
        assignedUserId: assignedUserId || undefined,
        minScore: minScore ? Number(minScore) : undefined,
      });
      setLeads(res.leads);
      setTotalPages(res.pagination.totalPages);
      setTotal(res.pagination.total);
    } catch {
      setError('Unable to load leads.');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, slaStatus, assignedUserId, minScore]);

  useEffect(() => {
    load();
  }, [load]);

  const canManageTeam = user?.role === 'owner' || user?.role === 'manager';

  useEffect(() => {
    if (canManageTeam) {
      listUsers().then((res) => setUsers(res.users)).catch(() => undefined);
      listDuplicates().then((res) => setDuplicateCount(res.duplicates.length)).catch(() => undefined);
    }
  }, [canManageTeam]);

  function resetPageAnd(setter: (v: string) => void) {
    return (v: string) => {
      setter(v);
      setPage(1);
    };
  }

  async function handleExport() {
    try {
      await downloadLeadsCsv();
    } catch {
      showToast('Unable to export leads.', 'error');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteLead(deleteTarget.id);
      showToast('Lead deleted.');
      setDeleteTarget(null);
      load();
    } catch {
      showToast('Unable to delete lead.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM"
        title="Leads"
        description={`${total} total lead${total === 1 ? '' : 's'} across your pipeline.`}
        actions={
          <>
            {(user?.role === 'owner' || user?.role === 'manager') && (
              <button className="btn-secondary" onClick={() => setShowImport(true)}>
                <Upload className="h-4 w-4" /> Import
              </button>
            )}
            {user?.role === 'owner' && (
              <button className="btn-secondary" onClick={handleExport}>
                <Download className="h-4 w-4" /> Export
              </button>
            )}
            <Link to="/leads/new" className="btn-primary">
              <Plus className="h-4 w-4" /> Add Lead
            </Link>
          </>
        }
      />

      {duplicateCount > 0 && (
        <button
          onClick={() => setShowDuplicates(true)}
          className="flex w-full items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800 hover:bg-amber-100"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {duplicateCount} possible duplicate lead{duplicateCount === 1 ? '' : 's'} awaiting review — click to review and merge.
        </button>
      )}

      <div className="card p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search name, company, email..."
              value={search}
              onChange={(e) => resetPageAnd(setSearch)(e.target.value)}
              aria-label="Search leads"
            />
          </div>
          <select className="select" value={status} onChange={(e) => resetPageAnd(setStatus)(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {canManageTeam && (
            <select className="select" value={assignedUserId} onChange={(e) => resetPageAnd(setAssignedUserId)(e.target.value)} aria-label="Filter by salesperson">
              <option value="">All salespeople</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          )}
          <select className="select" value={minScore} onChange={(e) => resetPageAnd(setMinScore)(e.target.value)} aria-label="Filter by minimum score">
            <option value="">Any score</option>
            <option value="70">Hot (70+)</option>
            <option value="40">Warm (40+)</option>
            <option value="0">Cold (0+)</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading leads..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : leads.length === 0 ? (
          <EmptyState
            icon={<Users2 className="h-6 w-6" />}
            title="No leads found"
            description="Try adjusting your filters, or add your first lead to get started."
            action={<Link to="/leads/new" className="btn-primary">Add Lead</Link>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3.5">Name</th>
                  <th className="px-5 py-3.5">Company</th>
                  <th className="px-5 py-3.5">Contact</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Score</th>
                  <th className="px-5 py-3.5">Assigned</th>
                  <th className="px-5 py-3.5">Created</th>
                  {(user?.role === 'owner' || user?.role === 'manager') && <th className="px-5 py-3.5" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead) => (
                  <tr key={lead.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <Link to={`/leads/${lead.id}`} className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-900 text-[11px] font-semibold text-white">
                          {initials(lead.name)}
                        </span>
                        <span className="font-semibold text-slate-900 hover:text-brand-600">{lead.name}</span>
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{lead.company || '—'}</td>
                    <td className="px-5 py-4 text-slate-600">
                      <div>{lead.email || '—'}</div>
                      <div className="text-xs text-slate-400">{lead.phone || ''}</div>
                    </td>
                    <td className="px-5 py-4"><StatusBadge status={lead.status} /></td>
                    <td className="px-5 py-4"><ScoreBadge score={lead.score} /></td>
                    <td className="px-5 py-4 text-slate-600">{lead.assigned_user_name || 'Unassigned'}</td>
                    <td className="px-5 py-4 text-slate-500">{new Date(lead.created_at).toLocaleDateString()}</td>
                    {(user?.role === 'owner' || user?.role === 'manager') && (
                      <td className="px-5 py-4 text-right">
                        <button
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                          aria-label={`Remove ${lead.name}`}
                          onClick={() => setDeleteTarget(lead)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {showImport && (
        <ImportLeadsModal
          onClose={() => setShowImport(false)}
          onImported={() => {
            load();
          }}
        />
      )}

      {showDuplicates && (
        <DuplicatesModal
          onClose={() => setShowDuplicates(false)}
          onMerged={() => {
            load();
            listDuplicates().then((res) => setDuplicateCount(res.duplicates.length)).catch(() => undefined);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove this lead?"
        description={`This permanently deletes ${deleteTarget?.name ?? 'this lead'} and its activity, notes, and follow-ups. This cannot be undone.`}
        confirmLabel={deleting ? 'Removing...' : 'Remove'}
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
