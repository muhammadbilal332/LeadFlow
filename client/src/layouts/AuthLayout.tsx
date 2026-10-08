import React from 'react';
import { Outlet, Link } from 'react-router-dom';

export default function AuthLayout(): React.ReactElement {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 10%, rgba(59,130,246,0.12), transparent 40%), radial-gradient(circle at 85% 90%, rgba(37,99,235,0.10), transparent 45%)',
        }}
        aria-hidden="true"
      />
      <div className="w-full max-w-md animate-fade-in">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2.5">
          <img src="/logo-mark.png" alt="" className="logo-mark-light-variant h-9 w-auto animate-logo-float" aria-hidden="true" />
          <img src="/logo-mark-dark.png" alt="" className="logo-mark-dark-variant h-9 w-auto animate-logo-float" aria-hidden="true" />
          <span className="text-xl font-bold tracking-tight text-navy-900">sellerClutch</span>
        </Link>
        <div className="card p-6 shadow-card sm:p-8">
          <Outlet />
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">Turn leads into customers.</p>
      </div>
    </div>
  );
}
