import { useState } from 'react';
import { EventCard } from '../components/EventCard';
import { StatsBar } from '../components/StatsBar';
import { StatusDot } from '../components/StatusDot';
import { useEventStream } from '../hooks/useEventStream';
import type { FeedEvent } from '../components/EventCard';
import type { EventType, PumpEvent } from '../types';

/** Convert WebSocket PumpEvent to FeedEvent for EventCard */
function toFeedEvent(e: PumpEvent, i: number): FeedEvent {
  const rec = e as unknown as Record<string, unknown>;
  return {
    id: `ws-${e.txSignature}-${i}`,
    type: e.type as EventType,
    timestamp: e.timestamp,
    txSignature: e.txSignature,
    tokenName: (rec.tokenName as string) ?? (rec.name as string) ?? 'Unknown',
    tokenSymbol: (rec.tokenSymbol as string) ?? (rec.symbol as string) ?? '???',
    creator: (rec.creator as string) ?? (rec.claimerWallet as string) ?? (rec.wallet as string) ?? '',
    amountSol: (rec.amountSol as number) ?? 0,
    direction: rec.direction as 'buy' | 'sell' | undefined,
    newCreator: rec.newCreator as string | undefined,
    shareholders: rec.shareholders as { address: string; amount: number }[] | undefined,
    isNew: true,
  };
}

// ── Filter config ───────────────────────────────────────

const FILTERS: { key: EventType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'launch', label: '🚀 Launches' },
  { key: 'whale', label: '🐋 Whales' },
  { key: 'graduation', label: '🎓 Graduations' },
  { key: 'claim', label: '💰 Claims' },
  { key: 'cto', label: '👑 CTO' },
  { key: 'distribution', label: '💎 Distributions' },
];

// ── Dashboard ───────────────────────────────────────────

export function Dashboard() {
  const { events: wsEvents, status } = useEventStream();
  const [filter, setFilter] = useState<EventType | 'all'>('all');

  const isLive = status === 'connected';
  const feedEvents: FeedEvent[] = wsEvents.map((e, i) => toFeedEvent(e, i));

  const filtered = filter === 'all' ? feedEvents : feedEvents.filter((e) => e.type === filter);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-2.75rem)]">
      {/* Filter bar */}
      <div className="sticky top-0 z-10 bg-tg-chat/95 backdrop-blur-sm border-b border-tg-border px-4 py-2">
        <div className="flex gap-2 overflow-x-auto max-w-3xl mx-auto items-center">
          <StatusDot status={status} />
          <div className="w-px h-5 bg-tg-border mx-1" />
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-sm transition whitespace-nowrap active:scale-95 ${
                filter === f.key
                  ? 'bg-tg-blue text-white shadow-tg'
                  : 'bg-tg-input text-zinc-400 hover:text-white hover:bg-tg-hover'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Event feed */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-2 p-4 max-w-3xl mx-auto">
          {/* Stats bar */}
          <StatsBar events={feedEvents} connected={isLive} />

          {/* Mode indicator */}
          <div className="text-center py-2">
            <span className="bg-tg-input/80 text-zinc-400 text-xs px-3 py-1 rounded-full">
              {isLive ? '🟢 Live Feed — PumpPortal' : status === 'connecting' ? '🟡 Connecting...' : '🔴 Disconnected — Reconnecting...'}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">{isLive ? '⏳' : '🔌'}</p>
              <p className="text-zinc-400 text-sm">
                {isLive ? 'Waiting for events...' : 'Connecting to PumpPortal...'}
              </p>
              <p className="text-zinc-500 text-xs mt-1">
                {isLive ? 'Real-time events will appear as they happen on-chain' : 'Establishing WebSocket connection'}
              </p>
            </div>
          ) : (
            filtered.map((event) => <EventCard key={event.id} event={event} />)
          )}
        </div>
      </div>

      {/* Bottom info bar */}
      <div className="border-t border-tg-border px-4 py-2 text-center">
        <span className="text-xs text-zinc-500">
          {isLive
            ? `Live stream • ${wsEvents.length} events received`
            : status === 'connecting'
              ? 'Connecting to PumpPortal WebSocket...'
              : 'Reconnecting...'}
        </span>
      </div>
    </div>
  );
}
