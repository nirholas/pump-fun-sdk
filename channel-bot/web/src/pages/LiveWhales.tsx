import { useState } from 'react';
import { StatusDot } from '../components/StatusDot';
import { useWhaleStream, type WhaleEntry } from '../hooks/useWhaleStream';

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

function fmtTokenAmount(raw: number): string {
  if (raw <= 0) return '—';
  if (raw >= 1e12) return (raw / 1e12).toFixed(1) + 'T';
  if (raw >= 1e9) return (raw / 1e9).toFixed(1) + 'B';
  if (raw >= 1e6) return (raw / 1e6).toFixed(1) + 'M';
  if (raw >= 1e3) return (raw / 1e3).toFixed(1) + 'K';
  return raw.toString();
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

type WhaleFilter = 'all' | 'buy' | 'sell';

const FILTERS: { key: WhaleFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'buy', label: '🟢 Buys' },
  { key: 'sell', label: '🔴 Sells' },
];

function WhaleRow({ whale }: { whale: WhaleEntry }) {
  const isBuy = whale.direction === 'buy';
  const displayName = whale.tokenName
    ? `${whale.tokenName}${whale.tokenSymbol ? ' $' + whale.tokenSymbol : ''}`
    : shortAddr(whale.mint);

  return (
    <div className={`flex gap-2 items-start ${whale.isNew ? 'animate-slide-in' : ''} group`}>
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-pump-orange flex items-center justify-center text-lg shrink-0 transition-transform group-hover:scale-105">
        🐋
      </div>

      {/* Bubble */}
      <div className="bg-tg-bubble-in rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] transition-colors hover:brightness-110">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-bold uppercase ${isBuy ? 'text-pump-green' : 'text-pump-pink'}`}>
            {isBuy ? '🟢 BUY' : '🔴 SELL'}
          </span>
          <span className="text-pump-orange text-xs font-semibold">{fmtSol(whale.solAmount)} SOL</span>
          <span className="text-[11px] text-zinc-500 ml-auto">{formatTime(whale.timestamp)}</span>
        </div>

        {/* Token info */}
        <p className="text-sm text-zinc-200">
          <a
            href={`https://pump.fun/coin/${whale.mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-pump-yellow hover:underline font-medium"
          >
            {displayName}
          </a>
        </p>

        {/* Amount row */}
        <div className="flex items-center gap-4 mt-1.5 text-xs">
          {whale.tokenAmount > 0 && (
            <span className="text-zinc-400">{fmtTokenAmount(whale.tokenAmount)} tokens</span>
          )}
          {whale.trader && (
            <a
              href={`https://solscan.io/account/${whale.trader}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-tg-blue hover:underline"
            >
              {shortAddr(whale.trader)}
            </a>
          )}
          <a
            href={`https://solscan.io/tx/${whale.signature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-tg-blue hover:underline ml-auto"
          >
            tx
          </a>
        </div>
      </div>
    </div>
  );
}

export function LiveWhales() {
  const { whales, status, stats } = useWhaleStream();
  const [filter, setFilter] = useState<WhaleFilter>('all');
  const [search, setSearch] = useState('');

  const filtered = whales.filter((w) => {
    if (filter !== 'all' && w.direction !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !w.mint.toLowerCase().includes(s) &&
        !(w.tokenName?.toLowerCase().includes(s)) &&
        !(w.tokenSymbol?.toLowerCase().includes(s))
      ) return false;
    }
    return true;
  });

  const buyPct = stats.buys + stats.sells > 0 ? Math.round((stats.buys / (stats.buys + stats.sells)) * 100) : 50;

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
            placeholder="Filter by token..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-tg-input text-sm text-zinc-300 placeholder-zinc-500 rounded-full px-3 py-1.5 outline-none focus:ring-1 focus:ring-tg-blue/40 transition w-44"
          />
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-2 p-4 max-w-3xl mx-auto">
          {/* Stats bar (outgoing bubble) */}
          <div className="max-w-[85%] ml-auto">
            <div className="bg-tg-bubble rounded-2xl rounded-br-sm px-4 py-3 text-white">
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                <div className="bg-tg-bubble-in/60 rounded-lg p-2 text-center">
                  <span className="text-lg">🐋</span>
                  <p className="text-base font-bold text-white mt-0.5">{stats.total}</p>
                  <p className="text-[10px] text-zinc-500">Whales</p>
                </div>
                <div className="bg-tg-bubble-in/60 rounded-lg p-2 text-center">
                  <span className="text-lg">🟢</span>
                  <p className="text-base font-bold text-pump-green mt-0.5">{stats.buys}</p>
                  <p className="text-[10px] text-zinc-500">Buys</p>
                </div>
                <div className="bg-tg-bubble-in/60 rounded-lg p-2 text-center">
                  <span className="text-lg">🔴</span>
                  <p className="text-base font-bold text-pump-pink mt-0.5">{stats.sells}</p>
                  <p className="text-[10px] text-zinc-500">Sells</p>
                </div>
                <div className="bg-tg-bubble-in/60 rounded-lg p-2 text-center">
                  <span className="text-lg">💎</span>
                  <p className="text-base font-bold text-pump-cyan mt-0.5">{fmtSol(stats.volumeSol)}</p>
                  <p className="text-[10px] text-zinc-500">Vol SOL</p>
                </div>
                <div className="bg-tg-bubble-in/60 rounded-lg p-2 text-center">
                  <span className="text-lg">🏆</span>
                  <p className="text-base font-bold text-pump-orange mt-0.5">{fmtSol(stats.biggestTrade)}</p>
                  <p className="text-[10px] text-zinc-500">Biggest</p>
                </div>
                <div className="bg-tg-bubble-in/60 rounded-lg p-2 text-center">
                  <span className="text-lg">⚡</span>
                  <p className="text-base font-bold text-pump-yellow mt-0.5">{stats.rate}</p>
                  <p className="text-[10px] text-zinc-500">Rate/s</p>
                </div>
              </div>

              {/* Buy/sell ratio bar */}
              <div className="mt-3">
                <div className="flex h-2 rounded-full overflow-hidden">
                  <div className="bg-pump-green transition-all duration-500" style={{ width: `${buyPct}%` }} />
                  <div className="bg-pump-pink transition-all duration-500" style={{ width: `${100 - buyPct}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                  <span>Buy {buyPct}%</span>
                  <span>⚡ {stats.rate}/s</span>
                  <span>Sell {100 - buyPct}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Mode indicator */}
          <div className="text-center py-2">
            <span className="bg-tg-input/80 text-zinc-400 text-xs px-3 py-1 rounded-full">
              {status === 'connected' ? '🟢 Live — Whale Trades ≥1 SOL' : status === 'connecting' ? '🟡 Connecting…' : '🔴 Disconnected — Reconnecting…'}
            </span>
          </div>

          {/* Whale feed */}
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🐋</p>
              <p className="text-zinc-400 text-sm">No whale trades yet.</p>
              <p className="text-zinc-500 text-xs mt-1">Trades ≥1 SOL will appear here as they come in</p>
            </div>
          ) : (
            filtered.map((whale) => <WhaleRow key={whale.id} whale={whale} />)
          )}
        </div>
      </div>
    </div>
  );
}
