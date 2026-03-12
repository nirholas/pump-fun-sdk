import { useState } from 'react';
import { StatusDot } from '../components/StatusDot';
import { useGraduationStream } from '../hooks/useGraduationStream';

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr || '';
  return addr.slice(0, 4) + '…' + addr.slice(-4);
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function LiveGraduations() {
  const { graduations, status, stats } = useGraduationStream();
  const [search, setSearch] = useState('');
  const [paused, setPaused] = useState(false);

  const filtered = search
    ? graduations.filter(
        (g) =>
          (g.tokenName || '').toLowerCase().includes(search.toLowerCase()) ||
          (g.tokenSymbol || '').toLowerCase().includes(search.toLowerCase()) ||
          g.mint.toLowerCase().includes(search.toLowerCase()),
      )
    : graduations;

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
            🎓 {stats.total}
          </span>
          <span className="bg-tg-input text-zinc-400 text-xs px-2.5 py-1 rounded-full">
            ⚡ {stats.rate}/s
          </span>

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
              {status === 'connected' ? '🟢 Live — Token Graduations' : status === 'connecting' ? '🟡 Connecting…' : '🔴 Disconnected — Reconnecting…'}
            </span>
          </div>

          {paused && (
            <div className="text-center py-8">
              <p className="text-2xl mb-2">⏸</p>
              <p className="text-zinc-400 text-sm">Feed paused</p>
              <p className="text-zinc-500 text-xs mt-1">Graduations are still tracked in the background</p>
            </div>
          )}

          {!paused && displayed.length === 0 && (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🎓</p>
              <p className="text-zinc-400 text-sm">Waiting for token graduations…</p>
              <p className="text-zinc-500 text-xs mt-1">Tokens migrating to PumpSwap AMM appear here in real-time</p>
            </div>
          )}

          {displayed.map((grad) => (
            <div key={grad.id} className={`flex gap-2 items-start ${grad.isNew ? 'animate-slide-in' : ''} group`}>
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-pump-purple flex items-center justify-center text-lg shrink-0 transition-transform group-hover:scale-105">
                🎓
              </div>

              {/* Message bubble */}
              <div className="bg-tg-bubble-in rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] transition-colors hover:bg-tg-bubble-in/80">
                <p className="text-pump-purple text-sm font-medium mb-1">Token Graduated!</p>

                <p className="text-sm text-zinc-200 font-medium">
                  Migrated to PumpSwap AMM
                </p>
                <p className="text-sm text-zinc-300 mt-1">
                  <span className="text-pump-yellow font-semibold">{grad.tokenName || 'Unknown'}</span>
                  {grad.tokenSymbol && (
                    <>
                      {' '}
                      <span className="text-pump-cyan font-semibold">${grad.tokenSymbol}</span>
                    </>
                  )}
                </p>

                {/* Metadata grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
                  <div>
                    <span className="text-zinc-500">Mint: </span>
                    <a
                      href={`https://pump.fun/coin/${grad.mint}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-tg-blue hover:underline"
                    >
                      {shortAddr(grad.mint)}
                    </a>
                  </div>
                  {grad.pool && (
                    <div>
                      <span className="text-zinc-500">Pool: </span>
                      <a
                        href={`https://solscan.io/account/${grad.pool}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-tg-blue hover:underline"
                      >
                        {shortAddr(grad.pool)}
                      </a>
                    </div>
                  )}
                  {grad.creator && (
                    <div>
                      <span className="text-zinc-500">Creator: </span>
                      <a
                        href={`https://solscan.io/account/${grad.creator}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-tg-blue hover:underline"
                      >
                        {shortAddr(grad.creator)}
                      </a>
                    </div>
                  )}
                </div>

                {/* Buttons */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <a
                    href={`https://pump.fun/coin/${grad.mint}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-tg-input text-pump-purple text-xs rounded-lg px-3 py-1.5 text-center hover:brightness-125 transition active:scale-95"
                  >
                    Trade on PumpSwap
                  </a>
                  <a
                    href={`https://solscan.io/tx/${grad.signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-tg-input text-tg-blue text-xs rounded-lg px-3 py-1.5 text-center hover:brightness-125 transition active:scale-95"
                  >
                    Explorer
                  </a>
                </div>

                <span className="text-[11px] text-zinc-500 block text-right mt-1">
                  {formatTime(grad.timestamp)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
