import { useState } from 'react';
import { StatusDot } from '../components/StatusDot';
import { useLaunchStream } from '../hooks/useLaunchStream';

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr || '';
  return addr.slice(0, 4) + '…' + addr.slice(-4);
}

function fmtMcap(sol: number): string {
  if (sol <= 0) return '';
  if (sol >= 1000) return sol.toFixed(0) + ' SOL';
  if (sol >= 1) return sol.toFixed(2) + ' SOL';
  return sol.toFixed(4) + ' SOL';
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function LiveLaunches() {
  const { launches, status, stats } = useLaunchStream();
  const [search, setSearch] = useState('');
  const [paused, setPaused] = useState(false);

  const filtered = search
    ? launches.filter(
        (l) =>
          l.name.toLowerCase().includes(search.toLowerCase()) ||
          l.symbol.toLowerCase().includes(search.toLowerCase()) ||
          l.mint.toLowerCase().includes(search.toLowerCase()),
      )
    : launches;

  const displayed = paused ? [] : filtered;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-2.75rem)]">
      {/* Filter bar */}
      <div className="sticky top-0 z-10 bg-tg-chat/95 backdrop-blur-sm border-b border-tg-border px-4 py-2">
        <div className="flex gap-2 items-center max-w-3xl mx-auto flex-wrap">
          <StatusDot status={status} />
          <div className="w-px h-5 bg-tg-border mx-1" />

          {/* Stats pills */}
          <span className="bg-tg-input text-zinc-400 text-xs px-2.5 py-1 rounded-full">
            🚀 {stats.total}
          </span>
          <span className="bg-tg-input text-zinc-400 text-xs px-2.5 py-1 rounded-full">
            ⚡ {stats.rate}/s
          </span>
          {stats.viewers > 0 && (
            <span className="bg-tg-input text-zinc-400 text-xs px-2.5 py-1 rounded-full">
              👥 {stats.viewers}
            </span>
          )}

          <div className="flex-1" />

          {/* Search */}
          <input
            type="text"
            placeholder="Filter by name, symbol, or mint..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-tg-input text-sm text-zinc-300 placeholder-zinc-500 rounded-full px-3 py-1.5 outline-none focus:ring-1 focus:ring-tg-blue/40 transition w-52"
          />

          {/* Pause */}
          <button
            onClick={() => setPaused((p) => !p)}
            className={`px-3 py-1.5 rounded-full text-xs transition active:scale-95 ${
              paused
                ? 'bg-pump-yellow/20 text-pump-yellow'
                : 'bg-tg-input text-zinc-400 hover:text-white'
            }`}
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-2 p-4 max-w-3xl mx-auto">
          {/* Mode indicator */}
          <div className="text-center py-2">
            <span className="bg-tg-input/80 text-zinc-400 text-xs px-3 py-1 rounded-full">
              {status === 'connected' ? '🟢 Live — New Token Launches' : status === 'connecting' ? '🟡 Connecting…' : '🔴 Disconnected — Reconnecting…'}
            </span>
          </div>

          {paused && (
            <div className="text-center py-8">
              <p className="text-2xl mb-2">⏸</p>
              <p className="text-zinc-400 text-sm">Feed paused</p>
              <p className="text-zinc-500 text-xs mt-1">New launches are still tracked in the background</p>
            </div>
          )}

          {!paused && displayed.length === 0 && (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🚀</p>
              <p className="text-zinc-400 text-sm">Waiting for new token launches…</p>
              <p className="text-zinc-500 text-xs mt-1">New tokens appear here the moment they're created on-chain</p>
            </div>
          )}

          {displayed.map((launch) => (
            <div key={launch.id} className={`flex gap-2 items-start ${launch.isNew ? 'animate-slide-in' : ''} group`}>
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-tg-blue flex items-center justify-center text-lg shrink-0 transition-transform group-hover:scale-105">
                🚀
              </div>

              {/* Message bubble */}
              <div className="bg-tg-bubble-in rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] transition-colors hover:bg-tg-bubble-in/80">
                <p className="text-tg-blue text-sm font-medium mb-1">PumpFun Live</p>

                <p className="text-sm text-zinc-200 font-medium">
                  🚀 New Token Launch
                </p>
                <p className="text-sm text-zinc-300 mt-1">
                  <span className="text-pump-yellow font-semibold">{launch.name}</span>
                  {' '}
                  <span className="text-pump-orange font-semibold">${launch.symbol}</span>
                </p>

                {/* Metadata grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
                  <div>
                    <span className="text-zinc-500">Mint: </span>
                    <a
                      href={`https://pump.fun/coin/${launch.mint}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-tg-blue hover:underline"
                    >
                      {shortAddr(launch.mint)}
                    </a>
                  </div>
                  <div>
                    <span className="text-zinc-500">Creator: </span>
                    <a
                      href={`https://solscan.io/account/${launch.creator}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-tg-blue hover:underline"
                    >
                      {shortAddr(launch.creator)}
                    </a>
                  </div>
                  {launch.marketCapSol > 0 && (
                    <div>
                      <span className="text-zinc-500">MCap: </span>
                      <span className="text-pump-purple font-medium">{fmtMcap(launch.marketCapSol)}</span>
                    </div>
                  )}
                </div>

                {/* Buttons */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <a
                    href={`https://pump.fun/coin/${launch.mint}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-tg-input text-tg-blue text-xs rounded-lg px-3 py-1.5 text-center hover:brightness-125 transition active:scale-95"
                  >
                    View on PumpFun
                  </a>
                  <a
                    href={`https://solscan.io/tx/${launch.signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-tg-input text-tg-blue text-xs rounded-lg px-3 py-1.5 text-center hover:brightness-125 transition active:scale-95"
                  >
                    Explorer
                  </a>
                </div>

                <span className="text-[11px] text-zinc-500 block text-right mt-1">
                  {formatTime(launch.timestamp)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
