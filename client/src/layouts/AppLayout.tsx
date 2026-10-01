import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users2,
  KanbanSquare,
  CalendarClock,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
  Zap,
  Inbox as InboxIcon,
  FileText,
  Megaphone,
  Send,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import NotificationBell from '../components/NotificationBell';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/inbox', label: 'Inbox', icon: InboxIcon },
  { to: '/leads', label: 'Leads', icon: Users2 },
  { to: '/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { to: '/follow-ups', label: 'Follow-ups', icon: CalendarClock },
  { to: '/forms', label: 'Forms', icon: FileText },
  { to: '/campaigns', label: 'Ad Campaigns', icon: Megaphone },
  { to: '/outreach', label: 'Outreach', icon: Send },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings/business', label: 'Settings', icon: Settings },
];

function initials(name: string | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export default function AppLayout(): React.ReactElement {
  const { user, business, logout } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-2 text-white shadow-soft">
          <Zap className="h-4 w-4" aria-hidden="true" fill="currentColor" />
        </span>
        <span className="text-lg font-bold tracking-tight text-slate-900">LeadFlow</span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={navLinkClass} onClick={() => setDrawerOpen(false)}>
            {({ isActive }) => (
              <>
                <item.icon className={`h-4 w-4 transition-colors ${isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'}`} aria-hidden="true" />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-4">
        <div className="flex items-center gap-2.5 rounded-lg px-1 py-1">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
            {initials(user?.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{business?.name}</p>
            <p className="truncate text-xs text-slate-500">{user?.name} &middot; {user?.role}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="btn-secondary mt-3 w-full justify-center">
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200/80 bg-white lg:block">
        {sidebarContent}
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <aside className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl">{sidebarContent}</aside>
        </div>
      )}

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 p-1.5 text-white">
            <Zap className="h-4 w-4" aria-hidden="true" fill="currentColor" />
          </span>
          <span className="text-base font-bold tracking-tight text-slate-900">LeadFlow</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
          >
            {drawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <header className="z-20 hidden items-center justify-end border-b border-slate-200/80 bg-white/80 px-6 py-2.5 backdrop-blur lg:fixed lg:top-0 lg:right-0 lg:left-64 lg:flex">
        <NotificationBell />
      </header>

      <main className="lg:pl-64 lg:pt-14">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
