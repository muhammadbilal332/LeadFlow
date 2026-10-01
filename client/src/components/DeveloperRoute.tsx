import React from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from './LoadingSpinner';

/**
 * Guards every /developer/* route. Unauthenticated -> redirect to
 * /developer/login. Authenticated but not role=developer -> an explicit
 * in-page access-denied state (not a silent redirect), so a sales/owner
 * user who lands here by guessing the URL sees clearly that this isn't
 * available to them rather than being bounced around unexplained.
 *
 * This is a UX convenience only — every /api/developer/* route
 * independently re-verifies the role server-side, since frontend route
 * protection alone is never the real security boundary.
 */
export default function DeveloperRoute({ children }: { children: React.ReactElement }): React.ReactElement {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <LoadingSpinner label="Checking session..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/developer/login" replace />;
  }

  if (user.role !== 'developer') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-4 text-center">
        <span className="rounded-full bg-red-950/50 p-3 text-red-400">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="text-lg font-semibold text-white">Access denied</h1>
        <p className="max-w-sm text-sm text-slate-400">Your account ({user.email}) does not have developer access to this console.</p>
        <a href="/dashboard" className="mt-2 text-sm font-medium text-indigo-400 hover:text-indigo-300">Go to your dashboard</a>
      </div>
    );
  }

  return children;
}
