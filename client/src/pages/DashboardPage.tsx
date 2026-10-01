import React, { useEffect, useState } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import { Users2, Sparkles, Trophy, XOctagon, TrendingUp, CalendarClock, Wallet, UserPlus, Inbox, Timer, PieChart as PieChartIcon, BarChart3, LineChart as LineChartIcon, Layers } from 'lucide-react';
import KpiCard from '../components/KpiCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import { getDashboard } from '../services/dashboardApi';
import { DashboardData } from '../types';
import { useAuth } from '../hooks/useAuth';

const STATUS_COLORS: Record<string, string> = {
  New: '#94a3b8',
  Contacted: '#60a5fa',
  Qualified: '#818cf8',
  Proposal: '#fbbf24',
  Negotiation: '#fb923c',
  Won: '#34d399',
  Lost: '#f87171',
};

function currency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function ChartCard({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-slate-100 p-1.5 text-slate-500">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="mt-3 h-64">{children}</div>
    </div>
  );
}

export default function DashboardPage(): React.ReactElement {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await getDashboard();
      setData(res);
    } catch {
      setError('Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingSpinner label="Loading dashboard..." />;
  if (error || !data) return <ErrorState message={error ?? 'Unknown error'} onRetry={load} />;

  const { kpis, charts } = data;

  const firstName = user?.name?.split(' ')[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-heading">{firstName ? `Welcome back, ${firstName}` : 'Dashboard'}</h1>
        <p className="mt-1 text-sm text-slate-500">Here's an overview of your sales pipeline and performance.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Leads" value={kpis.totalLeads} icon={Users2} to="/leads" />
        <KpiCard label="New Leads" value={kpis.newLeads} icon={UserPlus} accent="text-slate-600 bg-slate-100" to="/leads?status=New" />
        <KpiCard label="Qualified Leads" value={kpis.qualifiedLeads} icon={Sparkles} accent="text-indigo-600 bg-indigo-50" to="/leads?status=Qualified" />
        <KpiCard label="Won Deals" value={kpis.wonDeals} icon={Trophy} accent="text-emerald-600 bg-emerald-50" to="/leads?status=Won" />
        <KpiCard label="Lost Deals" value={kpis.lostDeals} icon={XOctagon} accent="text-red-600 bg-red-50" to="/leads?status=Lost" />
        <KpiCard label="Conversion Rate" value={`${kpis.conversionRate}%`} icon={TrendingUp} accent="text-brand-600 bg-brand-50" to="/reports" />
        <KpiCard label="Follow-ups Due" value={kpis.followUpsDue} icon={CalendarClock} accent="text-amber-600 bg-amber-50" to="/follow-ups" />
        <KpiCard label="Pipeline Value" value={currency(kpis.pipelineValue)} icon={Wallet} accent="text-teal-600 bg-teal-50" to="/pipeline" />
        <KpiCard label="Unworked Leads" value={kpis.unworkedLeads} icon={Inbox} accent="text-orange-600 bg-orange-50" to="/inbox" />
        <KpiCard label="SLA Compliance" value={`${kpis.slaComplianceRate}%`} icon={Timer} accent="text-violet-600 bg-violet-50" to="/reports" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Leads by Status" icon={PieChartIcon}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={charts.leadsByStatus} dataKey="count" nameKey="status" innerRadius={50} outerRadius={80} paddingAngle={3}>
                {charts.leadsByStatus.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#94a3b8'} stroke="white" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Lead Sources" icon={BarChart3}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.leadsBySource}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="source" fontSize={12} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Leads Over Time (30 days)" icon={LineChartIcon}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={charts.leadsOverTime}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" fontSize={11} tickLine={false} minTickGap={20} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
              <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Pipeline Value by Stage" icon={Layers}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.pipelineValueByStatus} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" fontSize={12} tickFormatter={(v) => currency(v)} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis type="category" dataKey="status" fontSize={12} width={90} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} formatter={(v: number) => currency(v)} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="value" fill="#14b8a6" radius={[0, 6, 6, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
