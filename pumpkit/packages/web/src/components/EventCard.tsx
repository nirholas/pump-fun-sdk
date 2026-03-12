import type { EventType } from '../types';

export interface FeedEvent {
  id: string;
  type: EventType;
  timestamp: string;
  txSignature: string;
  tokenName: string;
  tokenSymbol: string;
  creator: string;
  amountSol: number;
  direction?: 'buy' | 'sell';
  newCreator?: string;
  shareholders?: { address: string; amount: number }[];
  isNew?: boolean;
}

const avatarConfig: Record<string, { emoji: string; bg: string }> = {
  launch: { emoji: '🚀', bg: 'bg-tg-blue' },
  whale: { emoji: '🐋', bg: 'bg-pump-orange' },
  graduation: { emoji: '🎓', bg: 'bg-pump-purple' },
  claim: { emoji: '💰', bg: 'bg-pump-green' },
  cto: { emoji: '👑', bg: 'bg-pump-pink' },
  distribution: { emoji: '💎', bg: 'bg-pump-cyan' },
};

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getButtonUrl(label: string, event: FeedEvent): string {
  const sig = event.txSignature;
  switch (label) {
    case 'View TX':
    case 'Explorer':
      return `https://solscan.io/tx/${sig}`;
    case 'View on PumpFun':
      return `https://pump.fun/coin/${event.tokenSymbol}`;
    case 'View Pool':
    case 'Trade':
      return `https://pump.fun/coin/${event.tokenSymbol}`;
    case 'Fee Config':
      return `https://solscan.io/tx/${sig}`;
    default:
      return `https://solscan.io/tx/${sig}`;
  }
}

function InlineButtons({ labels, event }: { labels: string[]; event: FeedEvent }) {
  const cols = labels.length >= 2 ? 'grid-cols-2' : 'grid-cols-1';
  return (
    <div className={`grid ${cols} gap-2 mt-2`}>
      {labels.map((label) => (
        <a
          key={label}
          href={getButtonUrl(label, event)}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-tg-input text-tg-blue text-xs rounded-lg px-3 py-1.5 text-center hover:brightness-125 transition active:scale-95 cursor-pointer"
        >
          {label}
        </a>
      ))}
    </div>
  );
}

function EventContent({ event }: { event: FeedEvent }) {
  switch (event.type) {
    case 'launch':
      return (
        <>
          <p className="text-sm text-zinc-200 font-medium">🚀 New Token Launch</p>
          <p className="text-sm text-zinc-300 mt-1">
            {event.tokenName} (<span className="text-zinc-400">${event.tokenSymbol}</span>)
          </p>
          <p className="text-xs text-zinc-400">Creator: {event.creator}</p>
          <InlineButtons labels={['View on PumpFun', 'Explorer']} event={event} />
        </>
      );
    case 'whale': {
      const isBuy = event.direction === 'buy';
      return (
        <>
          <p className="text-sm text-zinc-200 font-medium">
            🐋 Whale {isBuy ? 'Buy' : 'Sell'} —{' '}
            <span className={isBuy ? 'text-pump-green' : 'text-pump-pink'}>
              {event.amountSol.toFixed(1)} SOL
            </span>
          </p>
          <p className="text-sm text-zinc-300 mt-1">
            {event.tokenName} (<span className="text-zinc-400">${event.tokenSymbol}</span>)
          </p>
          <p className="text-xs text-zinc-400">Wallet: {event.creator}</p>
          <InlineButtons labels={['View TX']} event={event} />
        </>
      );
    }
    case 'graduation':
      return (
        <>
          <p className="text-sm text-zinc-200 font-medium">🎓 Token Graduated!</p>
          <p className="text-sm text-zinc-300 mt-1">
            {event.tokenName} (<span className="text-zinc-400">${event.tokenSymbol}</span>) migrated to PumpSwap AMM
          </p>
          <p className="text-xs text-zinc-400">Liquidity: {event.amountSol.toFixed(1)} SOL</p>
          <InlineButtons labels={['View Pool', 'Trade']} event={event} />
        </>
      );
    case 'claim':
      return (
        <>
          <p className="text-sm text-zinc-200 font-medium">
            💰 Fee Claimed — <span className="text-pump-green">{event.amountSol.toFixed(1)} SOL</span>
          </p>
          <p className="text-sm text-zinc-300 mt-1">
            Creator {event.creator} claimed fees from {event.tokenName} (
            <span className="text-zinc-400">${event.tokenSymbol}</span>)
          </p>
          <InlineButtons labels={['View TX']} event={event} />
        </>
      );
    case 'cto':
      return (
        <>
          <p className="text-sm text-zinc-200 font-medium">👑 Creator Transfer</p>
          <p className="text-sm text-zinc-300 mt-1">
            {event.tokenName} (<span className="text-zinc-400">${event.tokenSymbol}</span>)
          </p>
          <p className="text-xs text-zinc-400">
            From: {event.creator} → To: {event.newCreator}
          </p>
          <InlineButtons labels={['View TX']} event={event} />
        </>
      );
    case 'distribution':
      return (
        <>
          <p className="text-sm text-zinc-200 font-medium">
            💎 Fee Distribution — <span className="text-pump-cyan">{event.amountSol.toFixed(1)} SOL</span>
          </p>
          <p className="text-sm text-zinc-300 mt-1">
            {event.tokenName} (<span className="text-zinc-400">${event.tokenSymbol}</span>)
          </p>
          {event.shareholders && event.shareholders.length > 0 && (
            <div className="text-xs text-zinc-400 mt-1 space-y-0.5">
              {event.shareholders.map((s) => (
                <p key={s.address}>{s.address}: {s.amount.toFixed(2)} SOL</p>
              ))}
            </div>
          )}
          <InlineButtons labels={['View TX', 'Fee Config']} event={event} />
        </>
      );
    default:
      return null;
  }
}

export function EventCard({ event }: { event: FeedEvent }) {
  const { emoji, bg } = avatarConfig[event.type] ?? { emoji: '📋', bg: 'bg-tg-input' };
  const animClass = event.isNew ? 'animate-slide-in' : '';

  return (
    <div className={`flex gap-2 items-start ${animClass} group`}>
      {/* Channel avatar */}
      <div
        className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center text-lg shrink-0 transition-transform group-hover:scale-105`}
      >
        {emoji}
      </div>
      {/* Message bubble */}
      <div className="bg-tg-bubble-in rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] transition-colors hover:bg-tg-bubble-in/80">
        <p className="text-tg-blue text-sm font-medium mb-1">PumpKit Live</p>
        <EventContent event={event} />
        <span className="text-[11px] text-zinc-500 block text-right mt-1">
          {formatTime(event.timestamp)}
        </span>
      </div>
    </div>
  );
}
