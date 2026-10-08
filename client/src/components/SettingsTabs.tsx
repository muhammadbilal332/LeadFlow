import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

// Automations and API keys are intentionally not linked here to keep this
// nav uncluttered — both pages and their underlying functionality (the
// automation-rule engine on every lead, and the scheduler API key) are untouched
// and still reachable directly at /settings/automations and
// /settings/api-keys.
const OWNER_ONLY_TABS = [
  { to: '/settings/business', label: 'Business' },
  { to: '/settings/users', label: 'Team members' },
  { to: '/settings/routing', label: 'Lead routing' },
  { to: '/settings/integrations', label: 'Integrations' },
];

export default function SettingsTabs(): React.ReactElement | null {
  const { user } = useAuth();
  if (user?.role !== 'owner' && user?.role !== 'manager') return null;

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {OWNER_ONLY_TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${
              isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
