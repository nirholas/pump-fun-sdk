import { useState } from 'react';
import { StatusDot } from '../components/StatusDot';
import { useClaimStream, type ClaimType, type ClaimEntry } from '../hooks/useClaimStream';

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr || '';
  return addr.slice(0, 4) + '…' + addr.slice(-4);
}

function fmtSol(sol: number): string {
  if (sol <= 0) return '—';
  if (sol >= 1000) return sol.toFixed(0);
  if (sol >= 1) return sol.toFixed(2);
  return sol.toFixed(4);
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const CLAIM_CONFIG: Record<ClaimType, { emoji: string; label: string; color: string; bg: string }> = {
  creator_fee: { emoji: '💰', label: 'Creator Fee', color: 'text-pump-green', bg: 'bg-pump-green/10' },
  cashback: { emoji: '🎁', label: 'Cashback', color: 'text-pump-yellow', bg: 'bg-pump-yellow/10' },
  social_fee: { emoji: '🤝', label: 'Social Fee', color: 'text-pump-purple', bg: 'bg-pump-purple/10' },
};

const FILTERS: { key: ClaimType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'creator_fee', label: '💰 Creator Fees' },
  { key: 'cashback', label: '🎁 Cashback' },
  { key: 'social_fee', label: '🤝 Social Fees' },
];

function ClaimRow({ claim }: { claim: ClaimEntry }) {
  const cfg = CLAIM_CONFIG[claim.claimType];
  const displayName = claim.tokenName
    ? `${claim.tokenName}${claim.tokenSymbol ? ' $' + claim.tokenSymbol : ''}`
    : shortAddr(claim.mint);

  return (
    <div className={`flex gap-2 items-start ${claim.isNew ? 'animate-slide-in' : ''} group`}>
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-pump-green flex items-center justify-center text-lg shrink-0 transition-transform group-hover:scale-105">
        💰
      </div>

      {/* Bubble */}
      <div className="bg-tg-bubble-in rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] transition-colors hover:brightness-110">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-bold uppercase ${cfg.color} ${cfg.bg} px-2 py-0.5 rounded-full`}>
            {cfg.emoji} {cfg.label}
          </span>
          <span className="text-[11px] text-zinc-500 ml-auto">{formatTime(claim.timestamp)}</span>
        </div>

        {/* SOL amount */}
        <p className="text-lg font-bold text-pump-green">
          +{fmtSol(claim.amountSol)} SOL
        </p>

        {/* Token info */}
        <p className="text-sm text-zinc-200 mt-1">
          <a
            href={`https://pump.fun/coin/${claim.mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-pump-yellow hover:underline font-medium"
          >
            {displayName}
          </a>
        </p>

        {/* Metadata row */}
        <div className="flex items-center gap-4 mt-1.5 text-xs flex-wrap">
          {claim.claimerWallet && (
            <span>
              <span className="text-zinc-500">Claimer: </span>
              <a
                href={`https://solscan.io/account/${claim.claimerWallet}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-tg-blue hover:underline"
              >
                {shortAddr(claim.claimerWallet)}
              </a>
            </span>
          )}
          <a
            href={`https://solscan.io/tx/${claim.signature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-tg-input text-tg-blue text-xs rounded-lg px-3 py-1 hover:brightness-125 transition active:scale-95 ml-auto"
          >
            View TX
          </a>
        </div>
      </div>
    </div>
  );
}

export function LiveClaims() {
  const { claims, status, stats, isDemo } = useClaimStream();
  const [filter, setFilter] = useState<ClaimType | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = claims.filter((c) => {
    if (filter !== 'all' && c.claimType !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !c.mint.toLowerCase().includes(s) &&
        !(c.tokenName?.toLowerCase().includes(s)) &&
        !(c.tokenSymbol?.toLowerCase().includes(s)) &&
        !c.claimerWallet.toLowerCase().includes(s)
      ) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-2.75rem)]">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-tg-chat/95 backdrop-blur-sm border-b border-tg-border px-4 py-2">
        <div className="flex gap-2 overflow-x-auto max-w-3xl mx-auto items-center flex-wrap">
          <StatusDot status={status} />
          {isDemo && (
            <span className="bg-pump-yellow/20 text-pump-yellow text-[10px] px-2 py-0.5 rounded-full font-medium">
              DEMO
            </span>
          )}
          <div className="w-px h-5 bg-tg-border mx-1" />
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs transition whitespace-nowrap active:scale-95 ${
                filter === f.key
                  ? 'bg-tg-blue text-white shadow-tg'
                  : 'bg-tg-input text-zinc-400 hover:text-white hover:bg-tg-hover'
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className="flex-1" />
          <input
            type="text"
            placeholder="Filter by wallet/token..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-tg-input text-sm text-zinc-300 placeholder-zinc-500 rounded-full px-3 py-1.5 outline-none focus:ring-1 focus:ring-tg-blue/40 transition w-48"
          />
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-2 p-4 max-w-3xl mx-auto">
          {/* Stats panel (outgoing bubble) */}
          <div className="max-w-[85%] ml-auto">
            <div className="bg-tg-bubble rounded-2xl rounded-br-sm px-4 py-3 text-white">
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                <div className="bg-tg-bubble-in/60 rounded-lg p-2 text-center">
                  <span className="text-lg">📊</span>
                  <p className="text-base font-bold text-white mt-0.5">{stats.total}</p>
                  <p className="text-[10px] text-zinc-500">Claims</p>
                </div>
                <div className="bg-tg-bubble-in/60 rounded-lg p-2 text-center">
                  <span className="text-lg">💎</span>
                  <p className="text-base font-bold text-pump-green mt-0.5">{fmtSol(stats.totalSol)}</p>
                  <p className="text-[10px] text-zinc-500">SOL Claimed</p>
                </div>
                <div className="bg-tg-bubble-in/60 rounded-lg p-2 text-center">
                  <span className="text-lg">💰</span>
                  <p className="text-base font-bold text-pump-green mt-0.5">{stats.creatorFees}</p>
                  <p className="text-[10px] text-zinc-500">Creator Fees</p>
                </div>
                <div className="bg-tg-bubble-in/60 rounded-lg p-2 text-center">
                  <span className="text-lg">🎁</span>
                  <p className="text-base font-bold text-pump-yellow mt-0.5">{stats.cashback}</p>
                  <p className="text-[10px] text-zinc-500">Cashback</p>
                </div>
                <div className="bg-tg-bubble-in/60 rounded-lg p-2 text-center">
                  <span className="text-lg">🤝</span>
                  <p className="text-base font-bold text-pump-purple mt-0.5">{stats.socialFees}</p>
                  <p className="text-[10px] text-zinc-500">Social Fees</p>
                </div>
                <div className="bg-tg-bubble-in/60 rounded-lg p-2 text-center">
                  <span className="text-lg">⚡</span>
                  <p className="text-base font-bold text-pump-cyan mt-0.5">{stats.rate}</p>
                  <p className="text-[10px] text-zinc-500">Rate/s</p>
                </div>
              </div>
            </div>
          </div>

          {/* Mode indicator */}
          <div className="text-center py-2">
            <span className="bg-tg-input/80 text-zinc-400 text-xs px-3 py-1 rounded-full">
              {status === 'connected'
                ? isDemo
                  ? '🟡 Demo — Sample Fee Claims'
                  : '🟢 Live — Fee Claims'
                : status === 'connecting'
                  ? '🟡 Connecting…'
                  : '🔴 Disconnected — Reconnecting…'}
            </span>
          </div>

          {/* Claim feed */}
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">💰</p>
              <p className="text-zinc-400 text-sm">Waiting for fee claims…</p>
              <p className="text-zinc-500 text-xs mt-1">Creator fee, cashback, and social fee claims will appear here</p>
            </div>
          ) : (
            filtered.map((claim) => <ClaimRow key={claim.id} claim={claim} />)
          )}
        </div>
      </div>
    </div>
  );
}
