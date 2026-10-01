import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox as InboxIcon, Phone } from 'lucide-react';
import * as leadsApi from '../services/leadsApi';
import { Lead } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import PriorityBadge from '../components/PriorityBadge';
import SlaBadge from '../components/SlaBadge';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

export default function InboxPage(): React.ReactElement {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await leadsApi.listLeads({ unworkedOnly: true, sortBy: 'created_at', sortDir: 'asc', pageSize: 50 });
      setLeads(res.leads);
    } catch {
      setError('Unable to load the inbox.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleContact(lead: Lead) {
    try {
      await leadsApi.updateLead(lead.id, { status: 'Contacted' });
      showToast(`Marked ${lead.name} as contacted.`);
      load();
    } catch {
      showToast('Unable to update lead.', 'error');
    }
  }

  async function handleAssignToMe(lead: Lead) {
    if (!user) return;
    try {
      await leadsApi.updateLead(lead.id, { assignedUserId: user.id });
      showToast(`${lead.name} assigned to you.`);
      load();
    } catch {
      showToast('Unable to assign lead.', 'error');
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Inbox</h1>
        <p className="text-sm text-slate-500">New, unworked leads — oldest first.</p>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading inbox..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : leads.length === 0 ? (
        <EmptyState icon={<InboxIcon className="h-6 w-6" />} title="Inbox zero" description="No new leads waiting to be worked. Nice." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {leads.map((lead) => (
            <div key={lead.id} className="card space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">New lead</p>
                  <Link to={`/leads/${lead.id}`} className="text-base font-semibold text-slate-900 hover:text-brand-700 hover:underline">
                    {lead.name}
                  </Link>
                </div>
                <PriorityBadge priority={lead.priority} score={lead.score} />
              </div>

              <p className="text-sm text-slate-600">{lead.source}{lead.interested_in ? ` · ${lead.interested_in}` : ''}</p>
              {lead.company && <p className="text-xs text-slate-500">{lead.company}</p>}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <SlaBadge state={lead.sla_state} dueAt={lead.sla_due_at} />
                <span className="text-xs text-slate-400">{new Date(lead.created_at).toLocaleString()}</span>
              </div>

              <p className="text-xs text-slate-500">
                {lead.assigned_user_name ? `Assigned to ${lead.assigned_user_name}` : 'Unassigned'}
              </p>

              <div className="flex flex-wrap gap-2 pt-2">
                <button className="btn-primary" onClick={() => handleContact(lead)}>
                  <Phone className="h-3.5 w-3.5" /> Contact
                </button>
                {!lead.assigned_user_id && (
                  <button className="btn-secondary" onClick={() => handleAssignToMe(lead)}>
                    Assign to me
                  </button>
                )}
                <Link to={`/leads/${lead.id}`} className="btn-secondary">View</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
