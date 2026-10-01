import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage(): React.ReactElement {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
      <p className="text-6xl font-bold text-brand-600">404</p>
      <h1 className="text-xl font-semibold text-slate-900">Page not found</h1>
      <p className="max-w-sm text-sm text-slate-500">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
      <Link to="/dashboard" className="btn-primary mt-2">Back to dashboard</Link>
    </div>
  );
}
