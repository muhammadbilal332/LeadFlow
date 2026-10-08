import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { createLead } from '../services/leadsApi';
import { listUsers } from '../services/usersApi';
import { User } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { ApiError } from '../lib/api';

export default function NewLeadPage(): React.ReactElement {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    industry: '',
    interestedIn: '',
    timeline: '',
    description: '',
    assignedUserId: '',
  });

  useEffect(() => {
    if ((user?.role === 'owner' || user?.role === 'manager')) {
      listUsers().then((res) => setUsers(res.users)).catch(() => undefined);
    }
  }, [user]);

  function update<K extends keyof typeof form>(field: K, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!form.name.trim()) {
      setFieldErrors({ name: 'Name is required' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await createLead({
        ...form,
        source: 'Manual',
        assignedUserId: form.assignedUserId || null,
      });
      showToast('Lead created successfully.');
      navigate(`/leads/${res.lead.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.details) setFieldErrors(Object.fromEntries(err.details.map((d) => [d.path, d.message])));
      } else {
        setError('Unable to create lead.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/leads" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Link>

      <div className="card p-6">
        <h1 className="text-xl font-semibold text-slate-900">Add a new lead</h1>
        <p className="mt-1 text-sm text-slate-500">Fill in what you know — you can always update details later.</p>

        {error && <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="name" className="label">Name *</label>
            <input id="name" className="input" value={form.name} onChange={(e) => update('name', e.target.value)} />
            {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
          </div>

          <div>
            <label htmlFor="company" className="label">Company</label>
            <input id="company" className="input" value={form.company} onChange={(e) => update('company', e.target.value)} />
          </div>
          <div>
            <label htmlFor="industry" className="label">Industry</label>
            <input id="industry" className="input" value={form.industry} onChange={(e) => update('industry', e.target.value)} />
          </div>

          <div>
            <label htmlFor="email" className="label">Email</label>
            <input id="email" type="email" className="input" value={form.email} onChange={(e) => update('email', e.target.value)} />
            {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
          </div>
          <div>
            <label htmlFor="phone" className="label">Phone</label>
            <input id="phone" className="input" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
          </div>

          {(user?.role === 'owner' || user?.role === 'manager') && (
            <div>
              <label htmlFor="assignedUserId" className="label">Assign to</label>
              <select id="assignedUserId" className="select" value={form.assignedUserId} onChange={(e) => update('assignedUserId', e.target.value)}>
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="sm:col-span-2">
            <label htmlFor="interestedIn" className="label">Interested in</label>
            <input id="interestedIn" className="input" value={form.interestedIn} onChange={(e) => update('interestedIn', e.target.value)} />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="timeline" className="label">Timeline</label>
            <input id="timeline" className="input" placeholder="e.g. This month, Next quarter, ASAP" value={form.timeline} onChange={(e) => update('timeline', e.target.value)} />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="description" className="label">Description</label>
            <textarea id="description" rows={4} className="input" value={form.description} onChange={(e) => update('description', e.target.value)} />
          </div>

          <div className="sm:col-span-2 flex justify-end gap-2">
            <Link to="/leads" className="btn-secondary">Cancel</Link>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Saving...' : 'Save lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
