import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export default function EmptyState({ title, description, icon, action }: EmptyStateProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="mb-2 rounded-full bg-slate-100 p-3 text-slate-400">{icon ?? <Inbox className="h-6 w-6" aria-hidden="true" />}</div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
