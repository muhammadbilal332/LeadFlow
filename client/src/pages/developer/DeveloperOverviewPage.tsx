import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Building2, Users2, Contact2, Megaphone, Mail, Clock, MessageSquareReply, Trophy, XOctagon, ShieldOff } from 'lucide-react';
import * as developerApi from '../../services/developerApi';
import { PlatformOverview, TimeSeriesPoint } from '../../types';
import KpiCard from '../../components/KpiCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';

function ChartCard({ title, data }: { title: string; data: TimeSeriesPoint[] }) {
  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 h-56">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">No data in this period</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" fontSize={11} tickLine={false} minTickGap={20} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
              <Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default function DeveloperOverviewPage(): React.ReactElement {
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [charts, setCharts] = useState<{ leadsOverTime: TimeSeriesPoint[]; emailsOverTime: TimeSeriesPoint[]; repliesOverTime: TimeSeriesPoint[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await developerApi.getOverview(30);
      setOverview(res.overview);
      setCharts(res.charts);
    } catch {
      setError('Unable to load platform overview.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingSpinner label="Loading platform overview..." />;
  if (error || !overview || !charts) return <ErrorState message={error ?? 'Unknown error'} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-heading">Platform overview</h1>
        <p className="mt-1 text-sm text-slate-500">Real-time statistics across every business on sellerClutch.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Businesses" value={overview.totalBusinesses} icon={Building2} />
        <KpiCard label="Total Users" value={overview.totalUsers} icon={Users2} accent="text-slate-600 bg-slate-100" />
        <KpiCard label="Total Leads" value={overview.totalLeads} icon={Contact2} accent="text-indigo-600 bg-indigo-50" />
        <KpiCard label="Active Campaigns" value={overview.activeCampaigns} icon={Megaphone} accent="text-brand-600 bg-brand-50" />
        <KpiCard label="Emails Sent" value={overview.emailsSent} icon={Mail} accent="text-emerald-600 bg-emerald-50" />
        <KpiCard label="Emails Queued" value={overview.emailsQueued} icon={Clock} accent="text-amber-600 bg-amber-50" />
        <KpiCard label="Replies Received" value={overview.repliesReceived} icon={MessageSquareReply} accent="text-violet-600 bg-violet-50" />
        <KpiCard label="Converted Leads" value={overview.convertedLeads} icon={Trophy} accent="text-teal-600 bg-teal-50" />
        <KpiCard label="Failed Emails" value={overview.failedEmails} icon={XOctagon} accent="text-red-600 bg-red-50" />
        <KpiCard label="Suppressed Contacts" value={overview.suppressedContacts} icon={ShieldOff} accent="text-orange-600 bg-orange-50" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Leads over time (30 days)" data={charts.leadsOverTime} />
        <ChartCard title="Emails sent over time (30 days)" data={charts.emailsOverTime} />
        <ChartCard title="Replies over time (30 days)" data={charts.repliesOverTime} />
      </div>
    </div>
  );
}
