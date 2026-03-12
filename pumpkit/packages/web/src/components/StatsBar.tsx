import type { FeedEvent } from './EventCard';

interface StatsBarProps {
  events: FeedEvent[];
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

  const totalSol = events.reduce((sum, e) => sum + e.amountSol, 0);

  const stats = [
    { label: 'Claims', value: counts['claim'] ?? 0, icon: '💰' },
    { label: 'Launches', value: counts['launch'] ?? 0, icon: '🚀' },
    { label: 'Graduations', value: counts['graduation'] ?? 0, icon: '🎓' },
    { label: 'Whales', value: counts['whale'] ?? 0, icon: '🐋' },
    { label: 'CTO', value: counts['cto'] ?? 0, icon: '👑' },
    { label: 'Volume', value: `${totalSol.toFixed(0)} SOL`, icon: '💎' },
  ];

  return (
    <div className="max-w-[85%] ml-auto">
      <div className="bg-tg-bubble rounded-2xl rounded-br-sm px-4 py-3 text-white">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="bg-tg-bubble-in/60 rounded-lg p-2 text-center card-hover">
              <span className="text-lg">{s.icon}</span>
              <p className="text-base font-bold text-white mt-0.5">{s.value}</p>
              <p className="text-[10px] text-zinc-500">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-zinc-500 mt-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-pump-green animate-pulse-glow' : 'bg-pump-pink'}`} />
          {connected ? 'Connected to monitor' : 'Disconnected'}
          <span className="text-zinc-600">·</span>
          <span>{events.length} events in feed</span>
        </div>
      </div>
    </div>
  );
}
