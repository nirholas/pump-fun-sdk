import { useCallback, useEffect, useRef, useState } from 'react';
import { EventCard } from '../components/EventCard';
import { StatsBar } from '../components/StatsBar';
import { useEventStream } from '../hooks/useEventStream';
import type { FeedEvent } from '../components/EventCard';
import type { EventType } from '../types';
import type { BaseEvent } from '../lib/types';

// ── Map API events to FeedEvent shape ───────────────────

let feedIdCounter = 0;

function apiEventToFeedEvent(raw: BaseEvent, isNew: boolean): FeedEvent {
  const id = `sse-${++feedIdCounter}`;
  const r = raw as unknown as unknown as Record<string, unknown>;
  return {
    id,
    type: raw.type as FeedEvent['type'],
    timestamp: raw.timestamp,
    txSignature: raw.txSignature,
    tokenName: (r.tokenName as string) ?? (r.name as string) ?? 'Unknown',
    tokenSymbol: (r.tokenSymbol as string) ?? (r.symbol as string) ?? '???',
    creator: (r.creator as string) ?? (r.claimerWallet as string) ?? (r.wallet as string) ?? '',
    amountSol: (r.amountSol as number) ?? 0,
    direction: r.direction as 'buy' | 'sell' | undefined,
    newCreator: r.newCreator as string | undefined,
    shareholders: r.shareholders as { address: string; amount: number }[] | undefined,
    isNew,
  };
}

// ── Mock data (fallback when no API configured) ─────────

const MOCK_TOKENS = [
  { name: 'PumpKitty', symbol: 'KITTY', creator: '7xKp...3nRm' },
  { name: 'SolDoge', symbol: 'SDOGE', creator: '3mFq...8vLp' },
  { name: 'MoonPump', symbol: 'MPUMP', creator: '9aHj...2wXk' },
  { name: 'BonkFren', symbol: 'BFREN', creator: '5cNr...7tQs' },
  { name: 'PepeSol', symbol: 'PEPE', creator: '2dLw...4mYn' },
  { name: 'DegenApe', symbol: 'DAPE', creator: '8bGx...1pRv' },
  { name: 'ChadCoin', symbol: 'CHAD', creator: '4fKt...6sWm' },
  { name: 'WenLambo', symbol: 'WEN', creator: '6eJy...9cDp' },
];

const EVENT_TYPES: EventType[] = ['launch', 'whale', 'graduation', 'claim', 'cto', 'distribution'];

function randomElement<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomSol(min: number, max: number): number {
  return +(min + Math.random() * (max - min)).toFixed(1);
}

let eventIdCounter = 0;

function generateEvent(timestamp: Date, isNew: boolean): FeedEvent {
  const token = randomElement(MOCK_TOKENS);
  const type = randomElement(EVENT_TYPES);
  const id = `evt-${++eventIdCounter}`;

  return {
    id,
    type,
    timestamp: timestamp.toISOString(),
    txSignature: `${id}-sig`,
    tokenName: token.name,
    tokenSymbol: token.symbol,
    creator: token.creator,
    amountSol: type === 'whale' ? randomSol(10, 200) : randomSol(0.5, 15),
    direction: type === 'whale' ? (Math.random() > 0.4 ? 'buy' : 'sell') : undefined,
    newCreator: type === 'cto' ? randomElement(MOCK_TOKENS).creator : undefined,
    shareholders: type === 'distribution'
      ? Array.from({ length: 2 + Math.floor(Math.random() * 2) }, () => ({
          address: randomElement(MOCK_TOKENS).creator,
          amount: randomSol(0.1, 5),
        }))
      : undefined,
    isNew,
  };
}

// ── useMockFeed hook ────────────────────────────────────

function useMockFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Generate initial batch on mount
  useEffect(() => {
    const now = Date.now();
    const initial: FeedEvent[] = [];
    const count = 8 + Math.floor(Math.random() * 5); // 8-12
    for (let i = 0; i < count; i++) {
      const ts = new Date(now - (count - i) * 20_000 - Math.random() * 10_000);
      initial.push(generateEvent(ts, false));
    }
    setEvents(initial);
  }, []);

  // Auto-add events at random 3-5s intervals
  const scheduleNext = useCallback(() => {
    const delay = 3000 + Math.random() * 2000;
    timerRef.current = setTimeout(() => {
      setEvents((prev) => {
        const next = [generateEvent(new Date(), true), ...prev];
        return next.slice(0, 50);
      });
      scheduleNext();
    }, delay);
  }, []);

  useEffect(() => {
    scheduleNext();
    return () => clearTimeout(timerRef.current);
  }, [scheduleNext]);

  return events;
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

const hasApiUrl = !!import.meta.env.VITE_API_URL;

export function Dashboard() {
  // Use real SSE stream when API is configured, mock feed otherwise
  const sseEvents = useEventStream();
  const mockEvents = useMockFeed();
  const isLive = hasApiUrl && sseEvents.length > 0;

  // Convert SSE BaseEvent[] into FeedEvent[] for EventCard
  const liveEvents: FeedEvent[] = sseEvents.map((e, i) => apiEventToFeedEvent(e, i === 0));
  const events = isLive ? liveEvents : mockEvents;

  const [filter, setFilter] = useState<EventType | 'all'>('all');

  const filtered = filter === 'all' ? events : events.filter((e) => e.type === filter);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-2.75rem)]">
      {/* Filter bar */}
      <div className="sticky top-0 z-10 bg-tg-chat/95 backdrop-blur-sm border-b border-tg-border px-4 py-2">
        <div className="flex gap-2 overflow-x-auto max-w-3xl mx-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-sm transition whitespace-nowrap ${
                filter === f.key
                  ? 'bg-tg-blue text-white'
                  : 'bg-tg-input text-zinc-400 hover:text-white'
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
          <StatsBar events={events} connected={isLive} />

          {/* Date separator */}
          <div className="text-center py-2">
            <span className="bg-tg-input/80 text-zinc-400 text-xs px-3 py-1 rounded-full">
              Today
            </span>
          </div>

          {filtered.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-8">No events for this filter yet.</p>
          ) : (
            filtered.map((event) => <EventCard key={event.id} event={event} />)
          )}
        </div>
      </div>

      {/* Bottom info bar */}
      <div className="border-t border-tg-border px-4 py-2 text-center">
        <span className="text-xs text-zinc-500">
          {isLive ? (
            <>🟢 Live feed from monitor bot</>
          ) : hasApiUrl ? (
            <>🟡 Connecting to monitor bot…</>
          ) : (
            <>Simulated feed &bull; Set <code className="text-tg-blue">VITE_API_URL</code> for live data</>
          )}
        </span>
      </div>
    </div>
  );
}
