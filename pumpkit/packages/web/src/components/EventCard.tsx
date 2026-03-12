import type { BaseEvent, ClaimEvent, LaunchEvent, GraduationEvent, WhaleEvent, CTOEvent } from '../lib/types';

const iconMap: Record<string, { icon: string; color: string }> = {
  claim: { icon: '💰', color: 'border-accent-green' },
  launch: { icon: '🚀', color: 'border-accent-blue' },
  graduation: { icon: '🎓', color: 'border-accent-purple' },
  whale: { icon: '🐋', color: 'border-accent-orange' },
  cto: { icon: '👑', color: 'border-accent-red' },
  distribution: { icon: '💎', color: 'border-accent-cyan' },
};

function shortAddr(addr: string): string {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function timeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function EventCard({ event }: { event: BaseEvent }) {
  const { icon, color } = iconMap[event.type] ?? { icon: '📋', color: 'border-border' };

  return (
    <div className={`bg-bg-card border-l-4 ${color} border border-border rounded-lg p-4`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{icon}</span>
          <span className="font-bold text-sm capitalize">{event.type}</span>
        </div>
        <span className="text-xs text-zinc-500">{timeAgo(event.timestamp)}</span>
      </div>
      <EventDetails event={event} />
      <a
        href={`https://solscan.io/tx/${event.txSignature}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-accent-blue hover:underline mt-2 inline-block"
      >
        {shortAddr(event.txSignature)}
      </a>
    </div>
  );
}

function EventDetails({ event }: { event: BaseEvent }) {
  switch (event.type) {
    case 'claim': {
      const e = event as ClaimEvent;
      return (
        <div className="text-sm text-zinc-300 space-y-0.5">
          <p>Claimer: <code className="text-xs">{shortAddr(e.claimerWallet)}</code></p>
          {e.tokenSymbol && <p>Token: {e.tokenSymbol}</p>}
          <p>Amount: {e.amountSol.toFixed(4)} SOL</p>
        </div>
      );
    }
    case 'launch': {
      const e = event as LaunchEvent;
      return (
        <div className="text-sm text-zinc-300 space-y-0.5">
          <p>{e.name} ({e.symbol})</p>
          <p>Creator: <code className="text-xs">{shortAddr(e.creator)}</code></p>
          {e.isCashback && <span className="text-xs bg-accent-green/20 text-accent-green px-1.5 py-0.5 rounded">Cashback</span>}
        </div>
      );
    }
    case 'graduation': {
      const e = event as GraduationEvent;
      return (
        <div className="text-sm text-zinc-300 space-y-0.5">
          {e.tokenName && <p>{e.tokenName}</p>}
          <p>Mint: <code className="text-xs">{shortAddr(e.tokenMint)}</code></p>
        </div>
      );
    }
    case 'whale': {
      const e = event as WhaleEvent;
      return (
        <div className="text-sm text-zinc-300 space-y-0.5">
          <p className={e.direction === 'buy' ? 'text-accent-green' : 'text-accent-red'}>
            {e.direction === 'buy' ? '🟢 BUY' : '🔴 SELL'} {e.amountSol.toFixed(2)} SOL
          </p>
          <p>Wallet: <code className="text-xs">{shortAddr(e.wallet)}</code></p>
        </div>
      );
    }
    case 'cto': {
      const e = event as CTOEvent;
      return (
        <div className="text-sm text-zinc-300 space-y-0.5">
          <p>Old: <code className="text-xs">{shortAddr(e.oldCreator)}</code></p>
          <p>New: <code className="text-xs">{shortAddr(e.newCreator)}</code></p>
        </div>
      );
    }
    default:
      return null;
  }
}
