import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';

export default function SignupPage(): React.ReactElement {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ businessName: '', name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await signup(form);
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.details) {
          setFieldErrors(Object.fromEntries(err.details.map((d) => [d.path, d.message])));
        }
      } else {
        setError('Unable to create your account. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Create your LeadFlow account</h1>
      <p className="mt-1 text-sm text-slate-500">Set up your business workspace in under a minute.</p>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="businessName" className="label">Business name</label>
          <input id="businessName" required className="input" value={form.businessName} onChange={(e) => update('businessName', e.target.value)} />
          {fieldErrors.businessName && <p className="mt-1 text-xs text-red-600">{fieldErrors.businessName}</p>}
        </div>
        <div>
          <label htmlFor="name" className="label">Your name</label>
          <input id="name" required className="input" value={form.name} onChange={(e) => update('name', e.target.value)} />
          {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
        </div>
        <div>
          <label htmlFor="email" className="label">Email address</label>
          <input id="email" type="email" required autoComplete="email" className="input" value={form.email} onChange={(e) => update('email', e.target.value)} />
          {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" type="password" required autoComplete="new-password" className="input" value={form.password} onChange={(e) => update('password', e.target.value)} />
          {fieldErrors.password && <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}
        </div>
        <div>
          <label htmlFor="confirmPassword" className="label">Confirm password</label>
          <input id="confirmPassword" type="password" required autoComplete="new-password" className="input" value={form.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)} />
          {fieldErrors.confirmPassword && <p className="mt-1 text-xs text-red-600">{fieldErrors.confirmPassword}</p>}
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Log in
        </Link>
      </p>
    </div>
  );
}
