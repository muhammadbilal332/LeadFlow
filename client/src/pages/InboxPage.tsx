import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox as InboxIcon, ArrowLeft } from 'lucide-react';
import * as outreachApi from '../services/outreachApi';
import { InboxReply, ConversationMessage } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  interested: 'bg-emerald-100 text-emerald-700',
  meeting_request: 'bg-emerald-100 text-emerald-700',
  question: 'bg-blue-100 text-blue-700',
  referral: 'bg-blue-100 text-blue-700',
  not_interested: 'bg-slate-100 text-slate-600',
  unsubscribe: 'bg-red-100 text-red-700',
  wrong_person: 'bg-slate-100 text-slate-600',
  out_of_office: 'bg-slate-100 text-slate-500',
  unknown: 'bg-slate-100 text-slate-500',
};

export default function InboxPage(): React.ReactElement {
  const [replies, setReplies] = useState<InboxReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<InboxReply | null>(null);
  const [conversation, setConversation] = useState<ConversationMessage[] | null>(null);
  const [threadSubject, setThreadSubject] = useState<string | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await outreachApi.getInbox();
      setReplies(res.replies);
    } catch {
      setError('Unable to load the inbox.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openThread(reply: InboxReply) {
    setSelected(reply);
    setThreadLoading(true);
    setConversation(null);

    // Optimistic: the backend marks every reply in this thread read as soon
    // as it's fetched, so reflect that locally right away rather than
    // waiting on a second round-trip or a full reload.
    setReplies((prev) => prev.map((r) => (r.thread_id === reply.thread_id ? { ...r, is_read: true } : r)));

    try {
      const res = await outreachApi.getThreadConversation(reply.thread_id);
      setConversation(res.conversation);
      setThreadSubject(res.thread.subject);
    } catch {
      setConversation([]);
    } finally {
      setThreadLoading(false);
    }
  }

  if (loading) return <LoadingSpinner label="Loading inbox..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const unreadCount = replies.filter((r) => !r.is_read).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Communication"
        title={
          <span className="flex items-center gap-3">
            Inbox
            {unreadCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-brand-500 px-2.5 py-0.5 text-sm font-semibold text-white">{unreadCount} unread</span>
            )}
          </span>
        }
        description="Every reply from a prospect, newest first — the full conversation, not just the latest message."
      />

      {replies.length === 0 ? (
        <EmptyState icon={<InboxIcon className="h-6 w-6" />} title="No replies yet" description="Replies to your outreach emails will show up here, automatically linked to the right lead." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className={`card overflow-hidden lg:col-span-2 ${selected ? 'hidden lg:block' : ''}`}>
            <ul className="divide-y divide-slate-100">
              {replies.map((r) => {
                const unread = !r.is_read;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => openThread(r)}
                      className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 ${
                        selected?.id === r.id ? 'bg-brand-50' : unread ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <span className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-900 text-[11px] font-semibold text-white">
                        {initials(r.contact_name || r.from_email)}
                        {unread && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-500" aria-hidden="true" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`truncate ${unread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                            {r.contact_name || r.from_email}
                          </p>
                          <span className={`shrink-0 text-xs ${unread ? 'font-semibold text-brand-700' : 'text-slate-400'}`}>
                            {new Date(r.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className={`truncate text-sm ${unread ? 'font-medium text-slate-800' : 'text-slate-600'}`}>
                          {r.subject || '(no subject)'}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CLASSIFICATION_COLORS[r.classification] || 'bg-slate-100 text-slate-500'}`}>
                            {r.classification.replace('_', ' ')}
                          </span>
                          {r.lead_id && <span className="text-xs text-slate-400">&middot; linked to lead</span>}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className={`card p-5 lg:col-span-3 ${selected ? '' : 'hidden lg:block'}`}>
            {!selected ? (
              <EmptyState icon={<InboxIcon className="h-6 w-6" />} title="Select a conversation" description="Pick a reply on the left to see the full thread." />
            ) : (
              <div>
                <button className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 lg:hidden" onClick={() => setSelected(null)}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">{threadSubject || selected.subject || '(no subject)'}</h2>
                    <p className="text-sm text-slate-500">
                      {selected.contact_name || selected.from_email} &middot; {selected.from_email}
                    </p>
                  </div>
                  {selected.lead_id && (
                    <Link to={`/leads/${selected.lead_id}`} className="btn-secondary">
                      View lead
                    </Link>
                  )}
                </div>

                {threadLoading ? (
                  <LoadingSpinner label="Loading conversation..." />
                ) : (
                  <ul className="mt-4 space-y-3">
                    {(conversation ?? []).map((m) => (
                      <li
                        key={`${m.direction}-${m.id}`}
                        className={`max-w-[85%] rounded-2xl p-4 text-sm shadow-soft ${
                          m.direction === 'outgoing' ? 'ml-auto bg-brand-500 text-white' : 'mr-auto bg-slate-100 text-slate-800'
                        }`}
                      >
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide opacity-70">
                          {m.direction === 'outgoing' ? 'You' : selected.contact_name || selected.from_email}
                          <span className="ml-2 font-normal normal-case opacity-80">{new Date(m.at).toLocaleString()}</span>
                        </p>
                        <p className="whitespace-pre-wrap">{m.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
