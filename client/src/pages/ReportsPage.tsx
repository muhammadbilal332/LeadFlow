import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { getReports } from '../services/dashboardApi';
import { ReportsData } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import KpiCard from '../components/KpiCard';
import { Users2, TrendingUp, Trophy, XOctagon, Timer, CheckCircle2 } from 'lucide-react';

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

const STATUS_COLORS: Record<string, string> = {
  New: '#94a3b8', Contacted: '#60a5fa', Qualified: '#818cf8', Proposal: '#fbbf24',
  Negotiation: '#fb923c', Won: '#34d399', Lost: '#f87171',
};

function currency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500">Sales analytics across your business.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total Leads" value={data.totalLeads} icon={Users2} />
        <KpiCard label="Conversion Rate" value={`${data.conversionRate}%`} icon={TrendingUp} accent="text-brand-600 bg-brand-50" />
        <KpiCard label="Won" value={data.won} icon={Trophy} accent="text-emerald-600 bg-emerald-50" />
        <KpiCard label="Lost" value={data.lost} icon={XOctagon} accent="text-red-600 bg-red-50" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Avg. Response Time" value={formatDuration(data.sla.avgResponseSeconds)} icon={Timer} accent="text-violet-600 bg-violet-50" />
        <KpiCard label="SLA Compliance" value={`${data.sla.complianceRate}%`} icon={CheckCircle2} accent="text-emerald-600 bg-emerald-50" />
        <KpiCard label="SLA Missed" value={data.sla.slaMissedCount} icon={XOctagon} accent="text-red-600 bg-red-50" />
        <KpiCard label="Overdue Leads" value={data.sla.overdueCount} icon={Timer} accent="text-amber-600 bg-amber-50" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-slate-900">Leads by Source</h2>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.leadsBySource}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="source" fontSize={12} tickLine={false} />
                <YAxis allowDecimals={false} fontSize={12} tickLine={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-semibold text-slate-900">Leads by Status</h2>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.leadsByStatus} dataKey="count" nameKey="status" innerRadius={50} outerRadius={80} paddingAngle={2}>
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
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Salesperson Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Total Leads</th>
                <th className="px-4 py-3">Won</th>
                <th className="px-4 py-3">Lost</th>
                <th className="px-4 py-3">Open Pipeline Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.salespersonPerformance.map((p) => (
                <tr key={p.userId}>
                  <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600">{p.totalLeads}</td>
                  <td className="px-4 py-3 text-emerald-600">{p.won}</td>
                  <td className="px-4 py-3 text-red-600">{p.lost}</td>
                  <td className="px-4 py-3 text-slate-600">{currency(p.pipelineValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Source Performance</h2>
          <p className="text-xs text-slate-500">Lead quality by acquisition channel.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Leads</th>
                <th className="px-4 py-3">Qualified</th>
                <th className="px-4 py-3">Won</th>
                <th className="px-4 py-3">Conversion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.sourcePerformance.map((s) => {
                const conversion = s.totalLeads > 0 ? Math.round((s.won / s.totalLeads) * 1000) / 10 : 0;
                return (
                  <tr key={s.source}>
                    <td className="px-4 py-3 font-medium text-slate-800">{s.source}</td>
                    <td className="px-4 py-3 text-slate-600">{s.totalLeads}</td>
                    <td className="px-4 py-3 text-slate-600">{s.qualified}</td>
                    <td className="px-4 py-3 text-emerald-600">{s.won}</td>
                    <td className="px-4 py-3 text-slate-600">{conversion}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Campaign Performance</h2>
            <p className="text-xs text-slate-500">Revenue and conversion by marketing campaign.</p>
          </div>
          <Link to="/campaigns" className="text-sm font-medium text-brand-600 hover:text-brand-700">View all &rarr;</Link>
        </div>
        {data.campaignPerformance.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">No campaign data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Leads</th>
                  <th className="px-4 py-3">Qualified</th>
                  <th className="px-4 py-3">Won</th>
                  <th className="px-4 py-3">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.campaignPerformance.slice(0, 5).map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <Link to={`/campaigns/${c.id}`} className="text-brand-700 hover:underline">{c.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.total_leads}</td>
                    <td className="px-4 py-3 text-slate-600">{c.qualified}</td>
                    <td className="px-4 py-3 text-emerald-600">{c.won}</td>
                    <td className="px-4 py-3 text-slate-600">{c.revenue > 0 ? currency(c.revenue) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
