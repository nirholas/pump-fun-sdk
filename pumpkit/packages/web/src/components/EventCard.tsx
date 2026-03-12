import type { MonitorEvent } from '../types';

interface FeedEvent extends MonitorEvent {
  tokenName: string;
  tokenSymbol: string;
  creator: string;
  amountSol: number;
  direction?: 'buy' | 'sell';
  newCreator?: string;
  isNew?: boolean;
}

const avatarConfig: Record<string, { emoji: string; bg: string }> = {
  launch: { emoji: '🚀', bg: 'bg-tg-blue' },
  whale: { emoji: '🐋', bg: 'bg-pump-orange' },
  graduation: { emoji: '🎓', bg: 'bg-pump-purple' },
  claim: { emoji: '💰', bg: 'bg-pump-green' },
  cto: { emoji: '👑', bg: 'bg-pump-pink' },
};

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function InlineButtons({ labels }: { labels: string[] }) {
  const cols = labels.length >= 2 ? 'grid-cols-2' : 'grid-cols-1';
  return (
    <div className={`grid ${cols} gap-2 mt-2`}>
      {labels.map((label) => (
        <span
          key={label}
          className="bg-tg-input text-tg-blue text-xs rounded-lg px-3 py-1.5 text-center select-none"
        >
          {label}
        </span>
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
          <InlineButtons labels={['View on PumpFun', 'Explorer']} />
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
          <InlineButtons labels={['View TX']} />
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
          <InlineButtons labels={['View Pool', 'Trade']} />
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
          <InlineButtons labels={['View TX']} />
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
          <InlineButtons labels={['View TX']} />
        </>
      );
    default:
      return null;
  }
}
