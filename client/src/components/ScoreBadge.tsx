import React from 'react';

function priorityFromScore(score: number): 'Low' | 'Medium' | 'High' | 'Hot' {
  if (score >= 85) return 'Hot';
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

const STYLES: Record<string, string> = {
  Hot: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-sky-100 text-sky-700',
};

export default function ScoreBadge({ score }: { score: number }): React.ReactElement {
  const priority = priorityFromScore(score);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[priority]}`} title={`Lead Score: ${priority} priority`}>
      {score}
    </span>
  );
}
