import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { getPersonEmails } from '../services/dashboardApi';
import { PersonEmail, PERFORMANCE_PERIODS, PerformancePeriod } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

const PERIOD_VALUES = PERFORMANCE_PERIODS.map((p) => p.value) as readonly string[];

function parsePeriod(value: string | null): PerformancePeriod {
  return value && PERIOD_VALUES.includes(value) ? (value as PerformancePeriod) : 'week';
}

export default function PersonEmailsPage(): React.ReactElement {
  const { userId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const period = parsePeriod(searchParams.get('period'));

  const [person, setPerson] = useState<{ name: string; role: string } | null>(null);
  const [emails, setEmails] = useState<PersonEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(selected: PerformancePeriod) {
    setLoading(true);
    setError(null);
    try {
      const res = await getPersonEmails(userId, selected);
      setPerson(res.person);
      setEmails(res.emails);
    } catch {
      setError('Unable to load this person\'s emails.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(period);
  }, [userId, period]);

  if (loading) return <LoadingSpinner label="Loading emails..." />;
  if (error) return <ErrorState message={error} onRetry={() => load(period)} />;

  const periodLabel = PERFORMANCE_PERIODS.find((p) => p.value === period)?.label ?? 'This week';

  return (
    <div className="space-y-6">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-heading">{person?.name ?? 'Salesperson'}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {emails.length} email{emails.length === 1 ? '' : 's'} sent · {periodLabel.toLowerCase()}
          </p>
        </div>
        <div className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-white p-1" role="group" aria-label="Performance period">
          {PERFORMANCE_PERIODS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={period === option.value}
              onClick={() => setSearchParams({ period: option.value })}
              className={`rounded-md px-3 py-1 text-xs font-medium ${period === option.value ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {emails.length === 0 ? (
        <EmptyState icon={<Mail className="h-6 w-6" />} title="No emails in this period" description="Try a longer period to see emails sent earlier." />
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {emails.map((email) => (
              <li key={email.id}>
                <Link to={`/dashboard/people/${userId}/emails/${email.id}`} className="block px-4 py-3 hover:bg-slate-50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">
                      To: {email.recipient_name || email.recipient_email}{' '}
                      <span className="font-normal text-slate-500">&lt;{email.recipient_email}&gt;</span>
                    </p>
                    <span className="text-xs text-slate-400">{email.sent_at ? new Date(email.sent_at).toLocaleString() : ''}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{email.subject}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className="capitalize text-slate-400">{email.status}</span>
                    {(email.reply_count ?? 0) > 0 ? (
                      <span className="rounded-full bg-teal-100 px-2 py-0.5 font-medium text-teal-700">
                        {email.reply_count} repl{email.reply_count === 1 ? 'y' : 'ies'}
                      </span>
                    ) : (
                      <span className="text-slate-400">No replies</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
