import React, { useEffect, useState } from 'react';
import { Contact2, Search } from 'lucide-react';
import * as developerApi from '../../services/developerApi';
import { PlatformLead } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';

const STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
const PAGE_SIZE = 25;

export default function DeveloperLeadsPage(): React.ReactElement {
  const [leads, setLeads] = useState<PlatformLead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await developerApi.listLeads({ search: search || undefined, status: status || undefined, page, pageSize: PAGE_SIZE });
      setLeads(res.leads);
      setTotal(res.total);
    } catch {
      setError('Unable to load leads.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-heading">Leads</h1>
        <p className="mt-1 text-sm text-slate-500">Cross-tenant lead visibility for platform support — sales/owner access in the CRM itself is unaffected.</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 gap-2">
          <input className="input" placeholder="Search name, company, email..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button type="submit" className="btn-secondary"><Search className="h-4 w-4" /></button>
        </form>
        <select className="input sm:w-48" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading leads..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <div className="card overflow-hidden">
          {leads.length === 0 ? (
            <EmptyState icon={<Contact2 className="h-6 w-6" />} title="No leads match" />
          ) : (
            <>
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Lead</th>
                    <th className="px-4 py-2">Company</th>
                    <th className="px-4 py-2">Business</th>
                    <th className="px-4 py-2">Source</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Score</th>
                    <th className="px-4 py-2">Assigned</th>
                    <th className="px-4 py-2">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-900">{l.name}</td>
                      <td className="px-4 py-2 text-slate-600">{l.company ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-600">{l.business_name}</td>
                      <td className="px-4 py-2 text-slate-600">{l.source}</td>
                      <td className="px-4 py-2 text-slate-600">{l.status}</td>
                      <td className="px-4 py-2 text-slate-600">{l.score}</td>
                      <td className="px-4 py-2 text-slate-600">{l.assigned_user_name ?? 'Unassigned'}</td>
                      <td className="px-4 py-2 text-slate-500">{new Date(l.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
                <span>{total} total lead{total === 1 ? '' : 's'}</span>
                <div className="flex gap-2">
                  <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                  <span className="px-2 py-1.5">Page {page} of {totalPages}</span>
                  <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
