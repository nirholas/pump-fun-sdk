import type { BaseEvent } from '../lib/types';

interface StatsBarProps {
  events: BaseEvent[];
  connected: boolean;
}

export function StatsBar({ events, connected }: StatsBarProps) {
  const counts = events.reduce(
    (acc, e) => {
      acc[e.type] = (acc[e.type] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const stats = [
    { label: 'Claims', value: counts['claim'] ?? 0, icon: '💰' },
    { label: 'Launches', value: counts['launch'] ?? 0, icon: '🚀' },
    { label: 'Graduations', value: counts['graduation'] ?? 0, icon: '🎓' },
    { label: 'Whales', value: counts['whale'] ?? 0, icon: '🐋' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {stats.map((s) => (
        <div key={s.label} className="bg-bg-card border border-border rounded-lg p-3 text-center">
          <span className="text-lg">{s.icon}</span>
          <p className="text-xl font-bold text-white mt-1">{s.value}</p>
          <p className="text-xs text-zinc-500">{s.label}</p>
        </div>
      ))}
      <div className="col-span-2 md:col-span-4 flex items-center justify-center gap-2 text-xs text-zinc-500">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-accent-green' : 'bg-accent-red'}`} />
        {connected ? 'Connected to monitor' : 'Disconnected'}
        <span className="text-zinc-600">·</span>
        <span>{events.length} events in feed</span>
      </div>
    </div>
  );
}
