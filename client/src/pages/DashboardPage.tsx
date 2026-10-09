import React, { useEffect, useState } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, CartesianGrid, XAxis, YAxis,
} from 'recharts';
import { PieChart as PieChartIcon, LineChart as LineChartIcon, ArrowRight, CalendarClock, Mail, TrendingUp } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import { Link } from 'react-router-dom';
import { getDashboard } from '../services/dashboardApi';
import { DashboardData, PerformancePeriod, PERFORMANCE_PERIODS } from '../types';
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function ChartCard({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-2.5">
        <div className="rounded-lg bg-brand-50 p-1.5 text-brand-600">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="mt-4 h-64">{children}</div>
    </div>
  );
}

export default function DashboardPage(): React.ReactElement {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PerformancePeriod>('week');

  async function load(selected: PerformancePeriod) {
    setLoading(true);
    setError(null);
    try {
      const res = await getDashboard(selected);
      setData(res);
    } catch {
      setError('Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(period);
  }, [period]);

  if (loading) return <LoadingSpinner label="Loading dashboard..." />;
  if (error || !data) return <ErrorState message={error ?? 'Unknown error'} onRetry={() => load(period)} />;

  const { kpis, salespeople, charts } = data;

  const firstName = user?.name?.split(' ')[0];

  // A single aggregate "team" panel, distinct from the per-person grid below
  // it — the primary-vs-secondary tier the layout is built around.
  const team = salespeople.reduce(
    (acc, p) => ({
      emailsSent: acc.emailsSent + p.emailsSent,
      repliesReceived: acc.repliesReceived + p.repliesReceived,
      newLeads: acc.newLeads + p.newLeads,
      won: acc.won + p.won,
      lost: acc.lost + p.lost,
    }),
    { emailsSent: 0, repliesReceived: 0, newLeads: 0, won: 0, lost: 0 }
  );
  const teamClosed = team.won + team.lost;
  const teamConversion = teamClosed > 0 ? Math.round((team.won / teamClosed) * 1000) / 10 : 0;

  return (
    <div className="space-y-10">
      {/* ---- Hero: oversized headline, real actions, metrics drawn from live data ---- */}
      <div className="hero-navy relative overflow-hidden p-8 sm:p-12">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="eyebrow text-brand-300">Dashboard</p>
            <h1 className="mt-3 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
              {firstName ? (
                <>
                  Welcome back,
                  <br />
                  <span className="text-brand-400">{firstName}</span>.
                </>
              ) : (
                'Welcome back.'
              )}
            </h1>
            <p className="mt-4 max-w-sm text-base text-slate-300">
              Here's where your pipeline stands and how your team is performing right now.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/pipeline" className="btn bg-brand-500 text-white shadow-soft hover:bg-brand-600">
                View pipeline <ArrowRight className="h-4 w-4" />
              </Link>
              {user?.role !== 'sales' && (
                <Link to="/reports" className="btn border border-white/20 bg-transparent text-white hover:bg-white/10">
                  View reports
                </Link>
              )}
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-3 gap-3 sm:gap-4">
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-center backdrop-blur sm:px-6">
              <p className="text-3xl font-bold text-white">{kpis.totalLeads}</p>
              <p className="mt-1 text-xs text-slate-300">Total leads</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-center backdrop-blur sm:px-6">
              <p className="text-3xl font-bold text-white">{kpis.conversionRate}%</p>
              <p className="mt-1 text-xs text-slate-300">Conversion</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-center backdrop-blur sm:px-6">
              <p className="text-3xl font-bold text-white">{kpis.followUpsDue}</p>
              <p className="mt-1 text-xs text-slate-300">Follow-ups due</p>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Performance: a primary team panel + follow-up shortcut, then individual cards beneath ---- */}
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-navy-900">Sales performance</h2>
            <p className="mt-0.5 text-sm text-slate-500">Activity within the selected period only.</p>
          </div>
          <div className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-white p-1" role="group" aria-label="Performance period">
            {PERFORMANCE_PERIODS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={period === option.value}
                onClick={() => setPeriod(option.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${period === option.value ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Primary panel: team aggregate — the single largest, most important number on the page besides the hero. */}
          <div className="card relative overflow-hidden p-6 lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-navy-900 p-1.5 text-white">
                <TrendingUp className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Team totals</h3>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-6 sm:grid-cols-4">
              <div>
                <p className="text-3xl font-bold tracking-tight text-navy-900">{team.emailsSent}</p>
                <p className="mt-1 text-xs text-slate-500">Emails sent</p>
              </div>
              <div>
                <p className="text-3xl font-bold tracking-tight text-navy-900">{team.repliesReceived}</p>
                <p className="mt-1 text-xs text-slate-500">Replies</p>
              </div>
              <div>
                <p className="text-3xl font-bold tracking-tight text-navy-900">{team.newLeads}</p>
                <p className="mt-1 text-xs text-slate-500">New leads</p>
              </div>
              <div>
                <p className="text-3xl font-bold tracking-tight text-navy-900">{teamConversion}%</p>
                <p className="mt-1 text-xs text-slate-500">Conversion</p>
              </div>
            </div>
          </div>

          {/* Secondary metric: a shortcut to Follow-ups, not just a number. */}
          <Link to="/follow-ups" className="card-hover flex flex-col justify-between p-6">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-amber-50 p-1.5 text-amber-600">
                <CalendarClock className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Follow-ups due</h3>
            </div>
            <div className="mt-5 flex items-end justify-between">
              <p className="text-4xl font-bold tracking-tight text-navy-900">{kpis.followUpsDue}</p>
              <span className="flex items-center gap-1 text-xs font-medium text-brand-600">
                Open queue <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>
        </div>

        {salespeople.length === 0 ? (
          <div className="card mt-4 p-6 text-sm text-slate-500">No salespeople have leads yet.</div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {salespeople.map((p) => (
              <Link
                key={p.userId}
                to={`/dashboard/people/${p.userId}?period=${period}`}
                className="card-hover flex flex-col p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold text-white">
                    {initials(p.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                    <span className="text-xs capitalize text-slate-500">{p.role}</span>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                    <Mail className="h-3 w-3" /> {p.emailsSent}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
                  <div>
                    <dd className="text-base font-semibold text-slate-900">{p.newLeads}</dd>
                    <dt className="text-[11px] text-slate-500">New</dt>
                  </div>
                  <div>
                    <dd className="text-base font-semibold text-emerald-600">{p.won}</dd>
                    <dt className="text-[11px] text-slate-500">Won</dt>
                  </div>
                  <div>
                    <dd className="text-base font-semibold text-red-500">{p.lost}</dd>
                    <dt className="text-[11px] text-slate-500">Lost</dt>
                  </div>
                </dl>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ---- Pipeline activity ---- */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-navy-900">Pipeline activity</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Leads by Status" icon={PieChartIcon}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={charts.leadsByStatus} dataKey="count" nameKey="status" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {charts.leadsByStatus.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#94a3b8'} stroke="white" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Leads Over Time (30 days)" icon={LineChartIcon}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.leadsOverTime}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" fontSize={11} tickLine={false} minTickGap={20} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
