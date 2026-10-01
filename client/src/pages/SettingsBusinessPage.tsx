import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { updateBusiness } from '../services/usersApi';
import { ApiError } from '../lib/api';
import SettingsTabs from '../components/SettingsTabs';

export default function SettingsBusinessPage(): React.ReactElement {
  const { business, user, refreshBusiness } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState({
    name: business?.name ?? '',
    email: business?.email ?? '',
    phone: business?.phone ?? '',
    industry: business?.industry ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await updateBusiness(form);
      await refreshBusiness();
      showToast('Business settings updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update business settings.');
    } finally {
      setSubmitting(false);
    }
  }

  const isOwner = user?.role === 'owner';

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Business settings</h1>
        <p className="text-sm text-slate-500">Manage your workspace details.</p>
      </div>

      <SettingsTabs />

      <div className="card p-6">
        {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit}>
          <fieldset disabled={!isOwner} className="space-y-4">
            <div>
              <label htmlFor="biz-name" className="label">Business name</label>
              <input id="biz-name" className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="biz-email" className="label">Email</label>
              <input id="biz-email" type="email" className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="biz-phone" className="label">Phone</label>
              <input id="biz-phone" className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="biz-industry" className="label">Industry</label>
              <input id="biz-industry" className="input" value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} />
            </div>
          </fieldset>

          {isOwner ? (
            <button type="submit" disabled={submitting} className="btn-primary mt-6">
              {submitting ? 'Saving...' : 'Save changes'}
            </button>
          ) : (
            <p className="mt-6 text-sm text-slate-500">Only the business owner can edit these settings.</p>
          )}
        </form>
      </div>
    </div>
  );
}
