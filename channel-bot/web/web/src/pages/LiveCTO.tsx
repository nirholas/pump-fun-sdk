import { useState } from 'react';
import { StatusDot } from '../components/StatusDot';
import { useCTOStream, type CTOFeedEntry } from '../hooks/useCTOStream';

type FilterKey = 'all' | 'cto' | 'distribution';

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

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'cto', label: '👑 CTO' },
  { key: 'distribution', label: '💎 Distributions' },
];

function CTORow({ entry }: { entry: CTOFeedEntry & { kind: 'cto' } }) {
  const displayName = entry.tokenName
    ? `${entry.tokenName}${entry.tokenSymbol ? ' $' + entry.tokenSymbol : ''}`
    : shortAddr(entry.mint);

  return (
    <div className={`flex gap-2 items-start ${entry.isNew ? 'animate-slide-in' : ''} group`}>
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-pump-pink flex items-center justify-center text-lg shrink-0 transition-transform group-hover:scale-105">
        👑
      </div>

      {/* Bubble */}
      <div className="bg-tg-bubble-in rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] transition-colors hover:brightness-110">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase text-pump-pink">Creator Transfer</span>
          <span className="bg-pump-pink/20 text-pump-pink text-[10px] px-1.5 py-0.5 rounded-full font-semibold">Community Takeover</span>
          <span className="text-[11px] text-zinc-500 ml-auto">{formatTime(entry.timestamp)}</span>
        </div>

        {/* Token info */}
        <p className="text-sm text-zinc-200">
          <a
            href={`https://pump.fun/coin/${entry.mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-pump-yellow hover:underline font-medium"
          >
            {displayName}
          </a>
        </p>

        {/* Creator transfer */}
        <div className="mt-1.5 text-xs space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">From:</span>
            <a
              href={`https://solscan.io/account/${entry.oldCreator}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-tg-blue hover:underline"
            >
              {shortAddr(entry.oldCreator)}
            </a>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">To:</span>
            <a
              href={`https://solscan.io/account/${entry.newCreator}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-pump-green hover:underline font-medium"
            >
              {shortAddr(entry.newCreator)}
            </a>
            <span className="text-pump-pink">→</span>
          </div>
        </div>

        {/* Button */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <a
            href={`https://pump.fun/coin/${entry.mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-tg-input text-tg-blue text-xs rounded-lg px-3 py-1.5 text-center hover:brightness-125 transition active:scale-95"
          >
            View on PumpFun
          </a>
          <a
            href={`https://solscan.io/tx/${entry.signature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-tg-input text-tg-blue text-xs rounded-lg px-3 py-1.5 text-center hover:brightness-125 transition active:scale-95"
          >
            View TX
          </a>
        </div>
      </div>
    </div>
  );
}

function DistributionRow({ entry }: { entry: CTOFeedEntry & { kind: 'distribution' } }) {
  const displayName = entry.tokenName
    ? `${entry.tokenName}${entry.tokenSymbol ? ' $' + entry.tokenSymbol : ''}`
    : shortAddr(entry.mint);

  return (
    <div className={`flex gap-2 items-start ${entry.isNew ? 'animate-slide-in' : ''} group`}>
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-pump-cyan flex items-center justify-center text-lg shrink-0 transition-transform group-hover:scale-105">
        💎
      </div>

      {/* Bubble */}
      <div className="bg-tg-bubble-in rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] transition-colors hover:brightness-110">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase text-pump-cyan">Fee Distribution</span>
          <span className="text-pump-cyan font-semibold text-xs">{fmtSol(entry.totalSol)} SOL</span>
          <span className="text-[11px] text-zinc-500 ml-auto">{formatTime(entry.timestamp)}</span>
        </div>

        {/* Token info */}
        <p className="text-sm text-zinc-200">
          <a
            href={`https://pump.fun/coin/${entry.mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-pump-yellow hover:underline font-medium"
          >
            {displayName}
          </a>
        </p>

        {/* Shareholder list */}
        {entry.shareholders.length > 0 && (
          <div className="mt-1.5 text-xs space-y-0.5">
            {entry.shareholders.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <a
                  href={`https://solscan.io/account/${s.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-tg-blue hover:underline"
                >
                  {shortAddr(s.address)}
                </a>
                <span className="text-pump-green font-medium">{fmtSol(s.amountSol)} SOL</span>
              </div>
            ))}
          </div>
        )}

        {/* Button */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <a
            href={`https://pump.fun/coin/${entry.mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-tg-input text-tg-blue text-xs rounded-lg px-3 py-1.5 text-center hover:brightness-125 transition active:scale-95"
          >
            View on PumpFun
          </a>
          <a
            href={`https://solscan.io/tx/${entry.signature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-tg-input text-tg-blue text-xs rounded-lg px-3 py-1.5 text-center hover:brightness-125 transition active:scale-95"
          >
            View TX
          </a>
        </div>
      </div>
    </div>
  );
}

export function LiveCTO() {
  const { entries, status, stats, isDemo } = useCTOStream();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');

  const filtered = entries.filter((e) => {
    if (filter !== 'all' && e.kind !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      const matchMint = e.mint.toLowerCase().includes(s);
      const matchName = e.tokenName?.toLowerCase().includes(s);
      const matchSymbol = e.tokenSymbol?.toLowerCase().includes(s);
      let matchWallet = false;
      if (e.kind === 'cto') {
        matchWallet = e.oldCreator.toLowerCase().includes(s) || e.newCreator.toLowerCase().includes(s);
      } else {
        matchWallet = e.shareholders.some((sh) => sh.address.toLowerCase().includes(s));
      }
      if (!matchMint && !matchName && !matchSymbol && !matchWallet) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-2.75rem)]">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-tg-chat/95 backdrop-blur-sm border-b border-tg-border px-4 py-2">
        <div className="flex gap-2 overflow-x-auto max-w-3xl mx-auto items-center flex-wrap">
          <StatusDot status={status} />
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
            placeholder="Filter by token, mint, wallet..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-tg-input text-sm text-zinc-300 placeholder-zinc-500 rounded-full px-3 py-1.5 outline-none focus:ring-1 focus:ring-tg-blue/40 transition w-52"
          />
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-2 p-4 max-w-3xl mx-auto">
          {/* Stats bar (outgoing bubble) */}
          <div className="max-w-[85%] ml-auto">
            <div className="bg-tg-bubble rounded-2xl rounded-br-sm px-4 py-3 text-white">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-tg-bubble-in/60 rounded-lg p-2 text-center">
                  <span className="text-lg">👑</span>
                  <p className="text-base font-bold text-pump-pink mt-0.5">{stats.totalCTO}</p>
                  <p className="text-[10px] text-zinc-500">CTO Events</p>
                </div>
                <div className="bg-tg-bubble-in/60 rounded-lg p-2 text-center">
                  <span className="text-lg">💎</span>
                  <p className="text-base font-bold text-pump-cyan mt-0.5">{stats.totalDistributions}</p>
                  <p className="text-[10px] text-zinc-500">Distributions</p>
                </div>
                <div className="bg-tg-bubble-in/60 rounded-lg p-2 text-center">
                  <span className="text-lg">💰</span>
                  <p className="text-base font-bold text-pump-green mt-0.5">{fmtSol(stats.totalDistributedSol)}</p>
                  <p className="text-[10px] text-zinc-500">SOL Distributed</p>
                </div>
                <div className="bg-tg-bubble-in/60 rounded-lg p-2 text-center">
                  <span className="text-lg">⚡</span>
                  <p className="text-base font-bold text-white mt-0.5">{stats.rate}</p>
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
                  ? '🟡 Demo Mode — Showing sample events'
                  : '🟢 Live — CTO & Distributions'
                : status === 'connecting'
                  ? '🟡 Connecting…'
                  : '🔴 Disconnected — Reconnecting…'}
            </span>
          </div>

          {/* Feed entries */}
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">👑💎</p>
              <p className="text-zinc-400 text-sm">Waiting for CTO & distribution events…</p>
              <p className="text-zinc-500 text-xs mt-1">Creator transfers and fee payouts will appear here in real-time</p>
            </div>
          ) : (
            filtered.map((entry) =>
              entry.kind === 'cto' ? (
                <CTORow key={entry.id} entry={entry} />
              ) : (
                <DistributionRow key={entry.id} entry={entry} />
              ),
            )
          )}
        </div>
      </div>
    </div>
  );
}
