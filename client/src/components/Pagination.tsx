import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps): React.ReactElement | null {
  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center justify-between border-t border-slate-200 px-4 py-3" aria-label="Pagination">
      <p className="text-sm text-slate-600">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <button
          className="btn-secondary"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>
        <button
          className="btn-secondary"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
