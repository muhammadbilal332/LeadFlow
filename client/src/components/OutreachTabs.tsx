import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

const PRIMARY_TABS = [
  { to: '/outreach', label: 'Overview', end: true },
  { to: '/outreach/contacts', label: 'Contacts' },
  { to: '/outreach/drafts', label: 'Drafts' },
];

const MORE_TABS = [
  { to: '/outreach/sequences', label: 'Sequences', description: 'Reusable multi-step email sequences behind auto-pilot imports and follow-ups.' },
  { to: '/outreach/suppressions', label: 'Suppressions', description: 'Addresses that will never be emailed.' },
];

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${
    isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
  }`;

export default function OutreachTabs(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const moreIsActive = MORE_TABS.some((t) => location.pathname.startsWith(t.to));

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex items-center gap-1 border-b border-slate-200">
      <div className="flex gap-1 overflow-x-auto">
        {PRIMARY_TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className={tabClass}>
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* Kept outside the overflow-x-auto row above — an absolutely
          positioned dropdown inside a scroll-clipped container gets its
          overflow silently clipped too (overflow-x: auto forces overflow-y
          to auto as well per the CSS spec), which hid this panel entirely. */}
      <div className="relative shrink-0" ref={containerRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-1 border-b-2 px-3 py-2 text-sm font-medium ${
            moreIsActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          More <ChevronDown className="h-3.5 w-3.5" />
        </button>

        {open && (
          <div className="absolute left-0 z-40 mt-1 w-64 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {MORE_TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) => `block px-3 py-2 text-sm hover:bg-slate-50 ${isActive ? 'bg-brand-50/60 text-brand-700' : 'text-slate-700'}`}
              >
                <p className="font-medium">{tab.label}</p>
                <p className="text-xs text-slate-500">{tab.description}</p>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
