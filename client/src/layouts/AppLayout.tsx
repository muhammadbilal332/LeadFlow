import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
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
  Send,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import NotificationBell from '../components/NotificationBell';
import ThemeToggle from '../components/ThemeToggle';

// Grouped, the way a deliberately-designed product sidebar reads — not one
// long undifferentiated list. Each group gets a small uppercase label.
const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/inbox', label: 'Inbox', icon: InboxIcon },
      { to: '/sent', label: 'Sent', icon: Send },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/leads', label: 'Leads', icon: Users2 },
      { to: '/pipeline', label: 'Pipeline', icon: KanbanSquare },
      { to: '/follow-ups', label: 'Follow-ups', icon: CalendarClock },
    ],
  },
  {
    label: 'Growth',
    items: [
      { to: '/outreach', label: 'Outreach', icon: Send },
      { to: '/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    label: 'Admin',
    items: [{ to: '/settings/business', label: 'Settings', icon: Settings }],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

function initials(name: string | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** The current section's label, for the top bar's page context — derived from the route, not re-typed per page. */
function usePageContext(): string {
  const { pathname } = useLocation();
  const match = ALL_NAV_ITEMS.filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`)).sort((a, b) => b.to.length - a.to.length)[0];
  if (match) return match.label;
  if (pathname.startsWith('/leads')) return 'Leads';
  if (pathname.startsWith('/settings')) return 'Settings';
  if (pathname.startsWith('/outreach')) return 'Outreach';
  return 'sellerClutch';
}

export default function AppLayout(): React.ReactElement {
  const { user, business, logout } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pageContext = usePageContext();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  // A solid, high-contrast pill for the active page — not a faint tint —
  // so it reads clearly in both the light (white) and dark (navy-card) nav.
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
      isActive ? 'bg-brand-500 text-white shadow-soft' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-6 py-6">
        <span className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-2 text-white shadow-soft">
          <Zap className="h-4 w-4" aria-hidden="true" fill="currentColor" />
        </span>
        <span className="text-lg font-bold tracking-tight text-navy-900">sellerClutch</span>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-4 pb-4" aria-label="Main navigation">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.label}</p>
            <div className="mt-2 space-y-0.5">
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} className={navLinkClass} onClick={() => setDrawerOpen(false)}>
                  {({ isActive }) => (
                    <>
                      <item.icon className={`h-[18px] w-[18px] transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} aria-hidden="true" />
                      {item.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-4">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
            {initials(user?.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{business?.name}</p>
            <p className="truncate text-xs text-slate-500">{user?.name} &middot; <span className="capitalize">{user?.role}</span></p>
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
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200/80 bg-white lg:block">
        {sidebarContent}
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <aside className="fixed inset-y-0 left-0 w-72 bg-white shadow-xl">{sidebarContent}</aside>
        </div>
      )}

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 p-1.5 text-white">
            <Zap className="h-4 w-4" aria-hidden="true" fill="currentColor" />
          </span>
          <span className="text-base font-bold tracking-tight text-navy-900">sellerClutch</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
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

      <header className="z-20 hidden items-center justify-between border-b border-slate-200/80 bg-white/80 px-8 py-3 backdrop-blur lg:fixed lg:top-0 lg:right-0 lg:left-72 lg:flex">
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <span className="font-medium text-slate-400">sellerClutch</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
          <span className="font-semibold text-slate-900">{pageContext}</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <NotificationBell />
        </div>
      </header>

      <main className="lg:pl-72 lg:pt-16">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
