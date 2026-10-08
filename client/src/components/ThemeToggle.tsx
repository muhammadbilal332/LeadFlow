import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme, Theme } from '../hooks/useTheme';

const OPTIONS: Array<{ value: Theme; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

export default function ThemeToggle(): React.ReactElement {
  const { theme, setTheme } = useTheme();

  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Theme">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
            theme === value ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
