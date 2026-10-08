import React, { useEffect, useState } from 'react';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Link } from 'react-router-dom';
import { getReports } from '../services/dashboardApi';
import { ReportsData } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import KpiCard from '../components/KpiCard';
import PageHeader from '../components/PageHeader';
import { PieChart as PieChartIcon, Trophy, XOctagon, Timer, CheckCircle2 } from 'lucide-react';

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

const STATUS_COLORS: Record<string, string> = {
  New: '#94a3b8', Contacted: '#60a5fa', Qualified: '#818cf8', Proposal: '#fbbf24',
  Negotiation: '#fb923c', Won: '#34d399', Lost: '#f87171',
};

export default function ReportsPage(): React.ReactElement {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await getReports());
    } catch {
      setError('Unable to load reports.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingSpinner label="Loading reports..." />;
  if (error || !data) return <ErrorState message={error ?? 'Unknown error'} onRetry={load} />;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Analytics" title="Reports" description="Sales analytics across your business." />

      {/* Primary analytics panel: the two headline numbers, oversized, with Won/Lost as a trend strip alongside — not just another row of identical tiles. */}
      <div className="card p-6 sm:p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-8 sm:flex-row sm:gap-14">
            <Link to="/leads" className="group">
              <p className="eyebrow text-slate-400">Total leads</p>
              <p className="mt-1 text-5xl font-bold tracking-tight text-navy-900 group-hover:text-brand-600">{data.totalLeads}</p>
            </Link>
            <Link to="/pipeline" className="group">
              <p className="eyebrow text-slate-400">Conversion rate</p>
              <p className="mt-1 text-5xl font-bold tracking-tight text-navy-900 group-hover:text-brand-600">{data.conversionRate}%</p>
            </Link>
          </div>
          <div className="flex gap-6 border-t border-slate-100 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <Link to="/leads?status=Won" className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 hover:bg-emerald-100">
              <Trophy className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-xl font-bold text-emerald-700">{data.won}</p>
                <p className="text-xs text-emerald-700/70">Won</p>
              </div>
            </Link>
            <Link to="/leads?status=Lost" className="flex items-center gap-3 rounded-xl bg-red-50 px-4 py-3 hover:bg-red-100">
              <XOctagon className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-xl font-bold text-red-600">{data.lost}</p>
                <p className="text-xs text-red-600/70">Lost</p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Secondary metrics: response-time and SLA health — compact, supporting the primary panel above. */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Service levels</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Avg. Response Time" value={formatDuration(data.sla.avgResponseSeconds)} icon={Timer} accent="text-violet-600 bg-violet-50" to="/leads" />
          <KpiCard label="SLA Compliance" value={`${data.sla.complianceRate}%`} icon={CheckCircle2} accent="text-emerald-600 bg-emerald-50" to="/leads?slaStatus=Met" />
          <KpiCard label="SLA Missed" value={data.sla.slaMissedCount} icon={XOctagon} accent="text-red-600 bg-red-50" to="/leads?slaStatus=Missed" />
          <KpiCard label="Overdue Leads" value={data.sla.overdueCount} icon={Timer} accent="text-amber-600 bg-amber-50" to="/leads?slaStatus=Pending" />
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-brand-50 p-1.5 text-brand-600">
            <PieChartIcon className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900">Leads by Status</h2>
        </div>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.leadsByStatus} dataKey="count" nameKey="status" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {data.leadsByStatus.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-900">Salesperson Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Name</th>
                <th className="px-5 py-3.5">Total Leads</th>
                <th className="px-5 py-3.5">Won</th>
                <th className="px-5 py-3.5">Lost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.salespersonPerformance.map((p) => (
                <tr key={p.userId} className="transition-colors hover:bg-slate-50">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-900 text-[10px] font-semibold text-white">
                        {initials(p.name)}
                      </span>
                      <span className="font-semibold text-slate-900">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{p.totalLeads}</td>
                  <td className="px-5 py-3.5 font-medium text-emerald-600">{p.won}</td>
                  <td className="px-5 py-3.5 font-medium text-red-600">{p.lost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
