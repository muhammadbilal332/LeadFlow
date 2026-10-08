import React from 'react';

interface PageHeaderProps {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

/**
 * The shared page header: a small uppercase eyebrow, an oversized title and
 * an optional description, with room for primary actions on the right. Used
 * app-wide in place of a bare `<h1>` so every page carries the same
 * typographic hierarchy and composition.
 */
export default function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow text-brand-600">{eyebrow}</p>
        <h1 className="mt-1.5 text-3xl font-bold leading-tight tracking-tight text-navy-900 sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
