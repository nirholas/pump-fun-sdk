import { useEffect, useState } from 'react';

const INTERVALS: [number, string][] = [
  [60, 's'],
  [3600, 'm'],
  [86400, 'h'],
  [604800, 'd'],
];

function format(timestamp: string | number): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 5) return 'just now';
  for (const [threshold, suffix] of INTERVALS) {
    if (seconds < threshold) {
      const prev = INTERVALS[INTERVALS.indexOf([threshold, suffix] as never) - 1];
      const divisor = prev ? prev[0] : 1;
      return `${Math.floor(seconds / divisor)}${prev ? prev[1] : 's'} ago`;
    }
  }
  return `${Math.floor(seconds / 86400)}d ago`;
}

/** Displays a relative time like "2s ago", "5m ago" that auto-updates */
export function TimeAgo({ timestamp }: { timestamp: string | number }) {
  const [text, setText] = useState(() => format(timestamp));

  useEffect(() => {
    const id = setInterval(() => setText(format(timestamp)), 5000);
    return () => clearInterval(id);
  }, [timestamp]);

  return <span className="text-xs text-zinc-500" title={new Date(timestamp).toLocaleString()}>{text}</span>;
}
