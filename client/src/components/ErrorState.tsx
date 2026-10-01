import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center" role="alert">
      <div className="mb-2 rounded-full bg-red-50 p-3 text-red-500">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-slate-700">Something went wrong</p>
      <p className="max-w-sm text-sm text-slate-500">{message}</p>
      {onRetry && (
        <button className="btn-secondary mt-3" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
