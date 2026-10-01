import React, { useEffect, useState } from 'react';
import { MessageSquareReply, Send } from 'lucide-react';
import * as outreachApi from '../services/outreachApi';
import { EmailReply } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import OutreachTabs from '../components/OutreachTabs';
import { useToast } from '../hooks/useToast';

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

export default function OutreachRepliesPage(): React.ReactElement {
  const { showToast } = useToast();
  const [replies, setReplies] = useState<EmailReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [simForm, setSimForm] = useState({ fromEmail: '', body: '' });
  const [simulating, setSimulating] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await outreachApi.listReplies();
      setReplies(res.replies);
    } catch {
      setError('Unable to load replies.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSimulate(e: React.FormEvent) {
    e.preventDefault();
    if (!simForm.fromEmail.trim() || !simForm.body.trim()) return;
    setSimulating(true);
    try {
      const res = await outreachApi.simulateReply(simForm);
      if (res.result.skipped) {
        showToast('No matching sent email found for that address — send a campaign to this contact first.', 'error');
      } else {
        showToast(`Reply classified as "${res.result.classification}".${res.result.leadCreated ? ' A new lead was created.' : ''}`);
        setSimForm({ fromEmail: '', body: '' });
        load();
      }
    } catch {
      showToast('Unable to simulate reply.', 'error');
    } finally {
      setSimulating(false);
    }
  }

  if (loading) return <LoadingSpinner label="Loading replies..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <OutreachTabs />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Replies</h1>
        <p className="text-sm text-slate-500">Every reply automatically stops that contact's follow-ups; a genuine reply also creates or updates a lead.</p>
      </div>

      <form onSubmit={handleSimulate} className="card space-y-2 p-4">
        <p className="text-xs font-medium uppercase text-slate-500">Simulate a reply (mock mode demo)</p>
        <input
          className="input"
          placeholder="From email — must match a contact you've already emailed"
          value={simForm.fromEmail}
          onChange={(e) => setSimForm({ ...simForm, fromEmail: e.target.value })}
        />
        <textarea
          className="input"
          placeholder="Reply body, e.g. 'Sounds interesting, tell me more!'"
          value={simForm.body}
          onChange={(e) => setSimForm({ ...simForm, body: e.target.value })}
        />
        <button type="submit" className="btn-primary" disabled={simulating}>
          <Send className="h-4 w-4" /> {simulating ? 'Sending...' : 'Simulate reply'}
        </button>
      </form>

      <div className="card overflow-hidden">
        {replies.length === 0 ? (
          <EmptyState icon={<MessageSquareReply className="h-6 w-6" />} title="No replies yet" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {replies.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900">{r.from_email}</p>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CLASSIFICATION_COLORS[r.classification] || 'bg-slate-100 text-slate-500'}`}>
                    {r.classification.replace('_', ' ')}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{r.body}</p>
                <p className="mt-1 text-xs text-slate-400">{new Date(r.created_at).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
