import { useCallback, useEffect, useRef, useState } from 'react';
import { EventCard } from '../components/EventCard';
import { StatsBar } from '../components/StatsBar';
import { StatusDot } from '../components/StatusDot';
import { useEventStream } from '../hooks/useEventStream';
import type { FeedEvent } from '../components/EventCard';
import type { EventType, PumpEvent } from '../types';

// ── Mock data (fallback when API is not available) ──────

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

function useMockFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const now = Date.now();
    const initial: FeedEvent[] = [];
    const count = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const ts = new Date(now - (count - i) * 20_000 - Math.random() * 10_000);
      initial.push(generateEvent(ts, false));
    }
    setEvents(initial);
  }, []);

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

/** Convert SSE PumpEvent to FeedEvent for EventCard */
function toFeedEvent(e: PumpEvent, i: number): FeedEvent {
  const rec = e as unknown as Record<string, unknown>;
  return {
    id: `sse-${e.txSignature}-${i}`,
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
  const { events: sseEvents, status } = useEventStream();
  const mockEvents = useMockFeed();
  const [filter, setFilter] = useState<EventType | 'all'>('all');

  // Use SSE events when connected and receiving data, otherwise mock
  const isLive = status === 'connected' && sseEvents.length > 0;
  const feedEvents: FeedEvent[] = isLive
    ? sseEvents.map((e, i) => toFeedEvent(e, i))
    : mockEvents;

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
              {isLive ? 'Live Feed' : 'Demo Mode'}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-zinc-400 text-sm">No events for this filter yet.</p>
              <p className="text-zinc-500 text-xs mt-1">Events will appear here as they come in</p>
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
            ? `Live stream \u2022 ${sseEvents.length} events received`
            : 'Simulated feed \u2022 Set VITE_API_URL to connect your bot'}
        </span>
      </div>
    </div>
  );
}
