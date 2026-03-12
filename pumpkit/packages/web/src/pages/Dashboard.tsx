import { useEffect, useState } from 'react';
import { fetchHealth } from '../lib/api';
import type { HealthResponse, EventType } from '../lib/types';
import { EventCard } from '../components/EventCard';
import { StatsBar } from '../components/StatsBar';
import { useEventStream } from '../hooks/useEventStream';

export function Dashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<EventType | 'all'>('all');
  const events = useEventStream();

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => setError('Could not connect to monitor API'));
  }, []);

  const filtered = filter === 'all' ? events : events.filter((e) => e.type === filter);

  return (
    <div className="flex h-[calc(100vh-65px)]">
      {/* Sidebar */}
      <aside className="w-64 bg-bg-sidebar border-r border-border p-4 flex flex-col gap-6 shrink-0 hidden lg:flex">
        {/* Status */}
        <div>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Status</h3>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${health ? 'bg-accent-green' : 'bg-accent-red'}`} />
            <span className="text-sm text-zinc-300">
              {health ? 'Connected' : error ?? 'Connecting…'}
            </span>
          </div>
          {health && (
            <p className="text-xs text-zinc-500 mt-1">Uptime: {Math.floor(health.uptime / 60)}m</p>
          )}
        </div>

        {/* Filters */}
        <div>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Filters</h3>
          <div className="flex flex-col gap-1">
            {(['all', 'claim', 'launch', 'graduation', 'whale', 'cto', 'distribution'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-left text-sm px-2 py-1 rounded transition ${
                  filter === f ? 'bg-bg-card text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {f === 'all' ? 'All Events' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Event Feed */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <StatsBar events={events} connected={!!health} />
          <h2 className="text-lg font-bold mb-4">
            Live Feed
            <span className="text-sm font-normal text-zinc-500 ml-2">
              {filtered.length} events
            </span>
          </h2>
          {filtered.length === 0 ? (
            <p className="text-zinc-500 text-sm">
              {error ?? 'Waiting for events… Connect the monitor bot API to see real-time data.'}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((event) => (
                <EventCard key={event.txSignature} event={event} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
