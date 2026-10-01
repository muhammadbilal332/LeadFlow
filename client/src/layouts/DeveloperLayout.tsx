import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Users2, Contact2, Send, Workflow, HeartPulse, Plug, Gauge,
  ScrollText, ShieldCheck, Settings, Menu, X, LogOut, ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const NAV_ITEMS = [
  { to: '/developer/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/developer/businesses', label: 'Businesses', icon: Building2 },
  { to: '/developer/users', label: 'Users', icon: Users2 },
  { to: '/developer/leads', label: 'Leads', icon: Contact2 },
  { to: '/developer/outreach', label: 'Outreach', icon: Send },
  { to: '/developer/n8n', label: 'n8n Automation', icon: Workflow },
  { to: '/developer/health', label: 'API Health', icon: HeartPulse },
  { to: '/developer/providers', label: 'Provider Status', icon: Plug },
  { to: '/developer/usage', label: 'Usage', icon: Gauge },
  { to: '/developer/logs', label: 'System Logs', icon: ScrollText },
  { to: '/developer/audit', label: 'Audit Logs', icon: ShieldCheck },
  { to: '/developer/settings', label: 'Settings', icon: Settings },
];

export default function DeveloperLayout(): React.ReactElement {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/developer/login');
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
    }`;

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="rounded-lg bg-indigo-600 p-1.5 text-white">
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-bold leading-tight text-white">LeadFlow</p>
          <p className="text-[11px] leading-tight text-slate-400">Developer Console</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Developer navigation">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass} onClick={() => setDrawerOpen(false)}>
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-800 p-4">
        <p className="truncate text-sm font-medium text-white">{user?.name}</p>
        <p className="truncate text-xs text-slate-400">{user?.email}</p>
        <button
          onClick={handleLogout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-800 bg-slate-900 lg:block">{sidebarContent}</aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <aside className="fixed inset-y-0 left-0 w-64 bg-slate-900 shadow-xl">{sidebarContent}</aside>
        </div>
      )}

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-indigo-600 p-1.5 text-white">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-sm font-bold text-white">Developer Console</span>
        </div>
        <button onClick={() => setDrawerOpen((v) => !v)} aria-label={drawerOpen ? 'Close menu' : 'Open menu'} className="rounded-md p-2 text-slate-300 hover:bg-slate-800">
          {drawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
