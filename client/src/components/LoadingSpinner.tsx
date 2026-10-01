import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ label = 'Loading...' }: { label?: string }): React.ReactElement {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-slate-500" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
