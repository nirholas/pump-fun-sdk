import { useState } from 'react';
import { StatusDot } from '../components/StatusDot';
import { useTradeStream, type TradeType, type TradeEntry } from '../hooks/useTradeStream';

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

const TYPE_CONFIG: Record<TradeType, { emoji: string; label: string; color: string; bg: string }> = {
  buy: { emoji: '🟢', label: 'BUY', color: 'text-pump-green', bg: 'bg-pump-green/10' },
  sell: { emoji: '🔴', label: 'SELL', color: 'text-pump-pink', bg: 'bg-pump-pink/10' },
  create: { emoji: '🚀', label: 'CREATE', color: 'text-pump-yellow', bg: 'bg-pump-yellow/10' },
  migrate: { emoji: '🎓', label: 'MIGRATE', color: 'text-pump-purple', bg: 'bg-pump-purple/10' },
};

const FILTERS: { key: TradeType | 'all' | 'whale'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'buy', label: '🟢 Buys' },
  { key: 'sell', label: '🔴 Sells' },
  { key: 'create', label: '🚀 Creates' },
  { key: 'whale', label: '🐋 Whales' },
];

function TradeRow({ trade }: { trade: TradeEntry }) {
  const cfg = TYPE_CONFIG[trade.type];
  const displayName = trade.tokenName
    ? `${trade.tokenName}${trade.tokenSymbol ? ' $' + trade.tokenSymbol : ''}`
    : shortAddr(trade.mint);

  return (
    <div className={`flex gap-2 items-start ${trade.isNew ? 'animate-slide-in' : ''} group`}>
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-full ${trade.isWhale ? 'bg-pump-orange' : 'bg-tg-input'} flex items-center justify-center text-lg shrink-0 transition-transform group-hover:scale-105`}>
        {trade.isWhale ? '🐋' : cfg.emoji}
      </div>

      {/* Bubble */}
      <div className={`${trade.isWhale ? 'bg-pump-orange/10 border border-pump-orange/20' : 'bg-tg-bubble-in'} rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] transition-colors hover:brightness-110`}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-bold uppercase ${cfg.color}`}>{cfg.label}</span>
          {trade.isWhale && <span className="text-pump-yellow text-xs">🐋 Whale</span>}
          <span className="text-[11px] text-zinc-500 ml-auto">{formatTime(trade.timestamp)}</span>
        </div>

        {/* Token info */}
        <p className="text-sm text-zinc-200">
          <a
            href={`https://pump.fun/coin/${trade.mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-pump-yellow hover:underline font-medium"
          >
            {displayName}
          </a>
        </p>

        {/* Amount row */}
        <div className="flex items-center gap-4 mt-1.5 text-xs">
          {trade.solAmount > 0 && (
            <span className={trade.type === 'buy' ? 'text-pump-green font-semibold' : trade.type === 'sell' ? 'text-pump-pink font-semibold' : 'text-zinc-400'}>
              {trade.type === 'sell' ? '-' : ''}{fmtSol(trade.solAmount)} SOL
            </span>
          )}
          {trade.tokenAmount > 0 && (
            <span className="text-zinc-400">{fmtTokenAmount(trade.tokenAmount)} tokens</span>
          )}
          {trade.trader && (
            <a
              href={`https://solscan.io/account/${trade.trader}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-tg-blue hover:underline"
            >
              {shortAddr(trade.trader)}
            </a>
          )}
          <a
            href={`https://solscan.io/tx/${trade.signature}`}
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

function WhalePanel({ alerts }: { alerts: TradeEntry[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="bg-tg-bubble rounded-2xl rounded-br-sm px-4 py-3 max-w-[85%] ml-auto mb-3">
      <p className="text-sm font-medium text-white mb-2">🐋 Recent Whale Alerts</p>
      <div className="space-y-1.5">
        {alerts.slice(0, 5).map((a) => (
          <div key={a.id} className="flex items-center gap-2 text-xs bg-pump-orange/10 rounded-lg px-3 py-1.5">
            <span>{a.type === 'buy' ? '🟢' : '🔴'}</span>
            <span className="text-pump-yellow font-bold">{fmtSol(a.solAmount)} SOL</span>
            <span className="text-zinc-400 uppercase text-[10px]">{a.type}</span>
            <span className="text-zinc-400 truncate max-w-[100px]">{a.tokenName || shortAddr(a.mint)}</span>
            <a
              href={`https://solscan.io/tx/${a.signature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-tg-blue hover:underline ml-auto"
            >
              view
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LiveTrades() {
  const { trades, status, stats, whaleAlerts } = useTradeStream();
  const [filter, setFilter] = useState<TradeType | 'all' | 'whale'>('all');
  const [search, setSearch] = useState('');

  const filtered = trades.filter((t) => {
    if (filter === 'whale' && !t.isWhale) return false;
    if (filter !== 'all' && filter !== 'whale' && t.type !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!t.mint.toLowerCase().includes(s) && !(t.tokenName?.toLowerCase().includes(s)) && !(t.tokenSymbol?.toLowerCase().includes(s))) return false;
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
                  <span className="text-lg">📊</span>
                  <p className="text-base font-bold text-white mt-0.5">{stats.total}</p>
                  <p className="text-[10px] text-zinc-500">Events</p>
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
                  <span className="text-lg">🚀</span>
                  <p className="text-base font-bold text-pump-yellow mt-0.5">{stats.creates}</p>
                  <p className="text-[10px] text-zinc-500">Creates</p>
                </div>
                <div className="bg-tg-bubble-in/60 rounded-lg p-2 text-center">
                  <span className="text-lg">🐋</span>
                  <p className="text-base font-bold text-pump-orange mt-0.5">{stats.whales}</p>
                  <p className="text-[10px] text-zinc-500">Whales</p>
                </div>
                <div className="bg-tg-bubble-in/60 rounded-lg p-2 text-center">
                  <span className="text-lg">💎</span>
                  <p className="text-base font-bold text-pump-cyan mt-0.5">{fmtSol(stats.volumeSol)}</p>
                  <p className="text-[10px] text-zinc-500">Vol SOL</p>
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
              {status === 'connected' ? '🟢 Live — All Trades' : status === 'connecting' ? '🟡 Connecting…' : '🔴 Disconnected — Reconnecting…'}
            </span>
          </div>

          {/* Whale alerts panel */}
          <WhalePanel alerts={whaleAlerts} />

          {/* Trade feed */}
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">📊</p>
              <p className="text-zinc-400 text-sm">No trades for this filter yet.</p>
              <p className="text-zinc-500 text-xs mt-1">Trades will appear here as they come in</p>
            </div>
          ) : (
            filtered.map((trade) => <TradeRow key={trade.id} trade={trade} />)
          )}
        </div>
      </div>
    </div>
  );
}
