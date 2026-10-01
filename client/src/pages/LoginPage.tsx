import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';

export default function LoginPage(): React.ReactElement {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to log in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Log in to LeadFlow</h1>
      <p className="mt-1 text-sm text-slate-500">Welcome back. Enter your details to continue.</p>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="label">Email address</label>
          <input id="email" type="email" required autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" type="password" required autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Logging in...' : 'Log in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Don&apos;t have an account?{' '}
        <Link to="/signup" className="font-medium text-brand-600 hover:text-brand-700">
          Sign up
        </Link>
      </p>

      <div className="mt-6 rounded-md bg-slate-50 p-3 text-xs text-slate-500">
        <p className="font-medium text-slate-600">Demo credentials</p>
        <p>Owner: owner@novagrowth.com / Demo1234!</p>
        <p>Sales: alex@novagrowth.com / Demo1234!</p>
      </div>
    </div>
  );
}
