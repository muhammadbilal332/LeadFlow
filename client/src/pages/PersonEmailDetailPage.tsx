import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Reply } from 'lucide-react';
import { getPersonEmail } from '../services/dashboardApi';
import { EmailReplyItem, PersonEmail } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';

export default function PersonEmailDetailPage(): React.ReactElement {
  const { userId = '', messageId = '' } = useParams();
  const [email, setEmail] = useState<PersonEmail | null>(null);
  const [replies, setReplies] = useState<EmailReplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await getPersonEmail(userId, messageId);
      setEmail(res.email);
      setReplies(res.replies);
    } catch {
      setError('Unable to load this email.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [userId, messageId]);

  if (loading) return <LoadingSpinner label="Loading email..." />;
  if (error || !email) return <ErrorState message={error ?? 'Email not found.'} onRetry={load} />;

  return (
    <div className="space-y-6">
      <Link to={`/dashboard/people/${userId}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to emails
      </Link>

      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium text-slate-900">
            To: {email.recipient_name || email.recipient_email}{' '}
            <span className="font-normal text-slate-500">&lt;{email.recipient_email}&gt;</span>
          </p>
          <span className="text-xs text-slate-400">{email.sent_at ? new Date(email.sent_at).toLocaleString() : ''}</span>
        </div>
        <h1 className="mt-2 text-lg font-semibold text-slate-900">{email.subject}</h1>
        <p className="mt-1 text-xs capitalize text-slate-400">Status: {email.status}</p>
        <p className="mt-4 whitespace-pre-wrap border-t border-slate-100 pt-4 text-sm text-slate-700">{email.body}</p>
        {email.failed_reason && <p className="mt-3 text-xs text-red-600">Failed: {email.failed_reason}</p>}
        {email.lead_id && (
          <Link to={`/leads/${email.lead_id}`} className="mt-4 inline-block text-sm text-brand-600 hover:underline">
            View lead
          </Link>
        )}
      </div>

      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Reply className="h-4 w-4 text-slate-400" /> Replies ({replies.length})
        </h2>
        {replies.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No replies yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {replies.map((reply) => (
              <li key={reply.id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">{reply.from_email}</p>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">{reply.classification.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-slate-400">{new Date(reply.created_at).toLocaleString()}</span>
                  </div>
                </div>
                {reply.subject && <p className="mt-1 text-xs text-slate-500">{reply.subject}</p>}
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{reply.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
