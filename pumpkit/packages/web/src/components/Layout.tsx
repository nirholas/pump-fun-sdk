import { useState, useEffect, useCallback } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { WatchForm } from './WatchForm';
import { WatchList } from './WatchList';
import { StatusDot } from './StatusDot';
import { useWatches } from '../hooks/useWatches';
import { useHealth } from '../hooks/useHealth';

const channels = [
  { path: '/', label: 'PumpKit', emoji: '🚀', preview: 'Create your own PumpFun bot', unread: false },
  { path: '/dashboard', label: 'Live Feed', emoji: '📡', preview: 'Real-time token events', unread: true },
  { path: '/create', label: 'Token Launch', emoji: '🪙', preview: 'How tokens work on PumpFun', unread: false },
  { path: '/docs', label: 'Docs', emoji: '📖', preview: '31 docs, 11 guides, 45 tutorials', unread: false },  { path: '/docs/browse', label: 'Browse Docs', emoji: '📄', preview: 'All guides & reference docs', unread: false },
  { path: '/tutorials', label: 'Tutorials', emoji: '📚', preview: '45 hands-on coding tutorials', unread: false },  { path: '/packages', label: 'Packages', emoji: '📦', preview: 'core, monitor, tracker, claim…', unread: false },
];

export function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [search, setSearch] = useState('');
  const current = channels.find((c) =>
    c.path === '/'
      ? location.pathname === '/'
      : location.pathname === c.path || location.pathname.startsWith(c.path + '/'),
  ) ?? channels[0]!;
  const { watches, loading: watchesLoading, add: addWatch, remove: removeWatch } = useWatches();
  const { health } = useHealth();

  // Close sidebar on mobile when navigating
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  // Keyboard shortcut: Escape to toggle sidebar
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && document.activeElement?.tagName !== 'INPUT') {
      setSidebarOpen((p) => !p);
    }
  }, []);
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const filteredChannels = search
    ? channels.filter(
        (ch) =>
          ch.label.toLowerCase().includes(search.toLowerCase()) ||
          ch.preview.toLowerCase().includes(search.toLowerCase()),
      )
    : channels;

  return (
    <div className="h-screen flex overflow-hidden bg-tg-bg">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Telegram Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-80 translate-x-0' : 'w-0 -translate-x-full lg:translate-x-0'
        } shrink-0 bg-tg-sidebar border-r border-tg-border flex flex-col transition-all duration-200 overflow-hidden fixed lg:relative h-full z-30`}
      >
        {/* Sidebar header */}
        <div className="h-14 flex items-center px-4 gap-3 border-b border-tg-border shrink-0">
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-zinc-400 hover:text-white transition"
            aria-label="Close sidebar"
          >
            ☰
          </button>
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search channels..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-tg-input text-sm text-zinc-300 placeholder-zinc-500 rounded-full px-4 py-1.5 outline-none focus:ring-1 focus:ring-tg-blue/40 transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Channel list */}
        <nav className="flex-1 overflow-y-auto py-1">
          {filteredChannels.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-8">No channels match</p>
          ) : (
            filteredChannels.map((ch) => {
              const active = ch.path === '/'
                ? location.pathname === '/'
                : location.pathname === ch.path || location.pathname.startsWith(ch.path + '/');
              return (
                <Link
                  key={ch.path}
                  to={ch.path}
                  className={`flex items-center gap-3 px-4 py-2.5 transition group ${
                    active
                      ? 'bg-tg-blue/20'
                      : 'hover:bg-tg-hover'
                  }`}
                >
                  {/* Avatar circle */}
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0 transition-colors ${
                      active ? 'bg-tg-blue' : 'bg-tg-input group-hover:bg-tg-hover'
                    }`}
                  >
                    {ch.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${active ? 'text-white' : 'text-zinc-200'}`}>
                        {ch.label}
                      </span>
                      {ch.unread && (
                        <span className="w-5 h-5 rounded-full bg-tg-blue text-[11px] text-white flex items-center justify-center font-medium animate-pulse-glow">
                          •
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-zinc-500 truncate">{ch.preview}</p>
                  </div>
                </Link>
              );
            })
          )}
        </nav>

        {/* Watch list section */}
        <div className="border-t border-tg-border flex flex-col flex-1 min-h-0">
          <p className="text-xs text-zinc-500 font-medium px-4 py-2">Watched Wallets ({watches.length})</p>
          <WatchForm onAdd={addWatch} />
          <WatchList watches={watches} loading={watchesLoading} onRemove={removeWatch} />
        </div>

        {/* Sidebar footer */}
        <div className="border-t border-tg-border px-4 py-3 shrink-0 space-y-2">
          <a
            href="https://github.com/nirholas/pumpkit"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-tg-blue transition"
          >
            <span>⭐</span>
            <span>Star on GitHub</span>
          </a>
          <p className="text-[10px] text-zinc-600">Press <kbd className="bg-tg-input px-1 rounded text-zinc-400">Esc</kbd> to toggle sidebar</p>
        </div>
      </aside>

      {/* Right Content Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Telegram-style top bar */}
        <header className="h-14 bg-tg-header border-b border-tg-border flex items-center px-4 gap-4 shrink-0">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-zinc-400 hover:text-white transition mr-1"
              aria-label="Open sidebar"
            >
              ☰
            </button>
          )}
          <div className="w-10 h-10 rounded-full bg-tg-input flex items-center justify-center text-lg">
            {current.emoji}
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-medium text-white leading-tight truncate">{current.label}</h1>
            <p className="text-xs text-zinc-500 truncate">{current.preview}</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <StatusDot status={health ? 'connected' : 'disconnected'} />
            <a
              href="https://github.com/nirholas/pumpkit"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-tg-blue transition text-sm hidden sm:block"
            >
              GitHub
            </a>
          </div>
        </header>

        {/* Main content area — styled like a chat background */}
        <main className="flex-1 overflow-y-auto bg-tg-chat">
          <Outlet />
        </main>

        {/* Cosmetic Telegram input bar */}
        <div className="shrink-0 bg-tg-header border-t border-tg-border px-4 py-2 flex items-center gap-3">
          <button className="text-zinc-500 hover:text-zinc-300 transition text-xl" aria-label="Emoji">😊</button>
          <div className="flex-1 bg-tg-input rounded-full px-4 py-2 text-sm text-zinc-500 flex items-center gap-1">
            <span>Message</span>
            <span className="typing-dot inline-block w-1 h-1 bg-zinc-500 rounded-full"></span>
            <span className="typing-dot inline-block w-1 h-1 bg-zinc-500 rounded-full"></span>
            <span className="typing-dot inline-block w-1 h-1 bg-zinc-500 rounded-full"></span>
          </div>
          <button className="text-zinc-500 hover:text-tg-blue transition text-xl" aria-label="Attach">📎</button>
          <button className="w-9 h-9 rounded-full bg-tg-blue flex items-center justify-center text-white text-sm hover:bg-tg-blue/80 transition active:scale-95" aria-label="Send">
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}
