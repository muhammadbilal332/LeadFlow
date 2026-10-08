import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';
import * as outreachApi from '../services/outreachApi';
import { SentMessage } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';

const STATUS_STYLES: Record<string, string> = {
  queued: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  bounced: 'bg-red-100 text-red-700',
  failed: 'bg-red-100 text-red-700',
};

export default function SentPage(): React.ReactElement {
  const [messages, setMessages] = useState<SentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await outreachApi.getSentMessages();
      setMessages(res.messages);
    } catch {
      setError('Unable to load sent messages.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingSpinner label="Loading sent messages..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Communication" title="Sent" description="Every outgoing email SellerClutch has sent, newest first." />

      {messages.length === 0 ? (
        <EmptyState icon={<Send className="h-6 w-6" />} title="Nothing sent yet" description="Emails you send from a lead's detail page or an outreach campaign will show up here." />
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {messages.map((m) => (
              <li key={m.id}>
                <button className="block w-full px-4 py-3 text-left hover:bg-slate-50" onClick={() => setExpanded((v) => (v === m.id ? null : m.id))}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">
                      To: {m.recipient_name || m.recipient_email}{' '}
                      <span className="font-normal text-slate-500">&lt;{m.recipient_email}&gt;</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[m.status] || 'bg-slate-100 text-slate-600'}`}>
                        {m.status}
                      </span>
                      <span className="text-xs text-slate-400">{new Date(m.sent_at ?? m.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{m.subject}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {m.campaign_name}
                    {m.lead_id && (
                      <>
                        {' '}
                        &middot;{' '}
                        <Link to={`/leads/${m.lead_id}`} className="text-brand-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                          View lead
                        </Link>
                      </>
                    )}
                  </p>
                </button>
                {expanded === m.id && (
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{m.body}</p>
                    {m.failed_reason && <p className="mt-2 text-xs text-red-600">Failed: {m.failed_reason}</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
