import React, { useState } from 'react';
import { Eye, EyeOff, ShieldCheck, Loader2 } from 'lucide-react';
import * as authApi from '../../services/authApi';
import { setToken, ApiError } from '../../lib/api';

export default function DeveloperLoginPage(): React.ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Enter both an email and a password.');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.login({ email: email.trim(), password });
      if (res.user.role !== 'developer') {
        // Deliberately never store this token — a non-developer account
        // must never get even a momentary authenticated session through
        // this page, regardless of whether its credentials were valid.
        setError('This account does not have developer access.');
        return;
      }

      setToken(res.token);
      // A full navigation (not client-side routing) so AppAuthProvider
      // re-initializes cleanly from the freshly stored token.
      window.location.href = '/developer/dashboard';
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-40"
        style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(99,102,241,0.25), transparent 45%), radial-gradient(circle at 80% 80%, rgba(56,189,248,0.15), transparent 50%)' }}
        aria-hidden="true"
      />
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-3 rounded-xl bg-slate-800 p-2.5 text-indigo-400 ring-1 ring-slate-700">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="text-lg font-bold tracking-tight text-white">sellerClutch Developer Console</h1>
          <p className="mt-1 text-sm text-slate-400">Platform administration — authorized personnel only.</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="space-y-4">
            <div>
              <label htmlFor="dev-email" className="mb-1 block text-sm font-medium text-slate-300">Email</label>
              <input
                id="dev-email"
                type="email"
                autoComplete="username"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="dev-password" className="mb-1 block text-sm font-medium text-slate-300">Password</label>
              <div className="relative">
                <input
                  id="dev-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 pr-10 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-200"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-lg border border-red-900/50 bg-red-950/50 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">This console is separate from the sellerClutch CRM. If you're looking for the sales app, go to the regular login page.</p>
      </div>
    </div>
  );
}
