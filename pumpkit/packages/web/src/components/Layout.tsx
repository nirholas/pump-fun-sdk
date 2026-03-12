import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';

const channels = [
  { path: '/', label: 'PumpKit', emoji: '🚀', preview: 'Create your own PumpFun bot', unread: false },
  { path: '/dashboard', label: 'Live Feed', emoji: '📡', preview: 'Real-time token events', unread: true },
  { path: '/docs', label: 'Docs', emoji: '📖', preview: 'Guides, API reference, tutorials', unread: false },
  { path: '/packages', label: 'Packages', emoji: '📦', preview: 'core, monitor, tracker, claim…', unread: false },
];

export function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const current = channels.find((c) => c.path === location.pathname) ?? channels[0]!;

  return (
    <div className="h-screen flex overflow-hidden bg-tg-bg">
      {/* Telegram Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-80' : 'w-0'
        } shrink-0 bg-tg-sidebar border-r border-tg-border flex flex-col transition-all duration-200 overflow-hidden`}
      >
        {/* Sidebar header */}
        <div className="h-14 flex items-center px-4 gap-3 border-b border-tg-border shrink-0">
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-zinc-400 hover:text-white transition lg:hidden"
          >
            ☰
          </button>
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search"
              className="w-full bg-tg-input text-sm text-zinc-300 placeholder-zinc-500 rounded-full px-4 py-1.5 outline-none focus:ring-1 focus:ring-tg-blue/40"
            />
          </div>
        </div>

        {/* Channel list */}
        <nav className="flex-1 overflow-y-auto py-1">
          {channels.map((ch) => {
            const active = location.pathname === ch.path;
            return (
              <Link
                key={ch.path}
                to={ch.path}
                className={`flex items-center gap-3 px-4 py-2.5 transition ${
                  active
                    ? 'bg-tg-blue/20'
                    : 'hover:bg-tg-hover'
                }`}
              >
                {/* Avatar circle */}
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0 ${
                    active ? 'bg-tg-blue' : 'bg-tg-input'
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
                      <span className="w-5 h-5 rounded-full bg-tg-blue text-[11px] text-white flex items-center justify-center font-medium">
                        •
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-zinc-500 truncate">{ch.preview}</p>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-tg-border px-4 py-3">
          <a
            href="https://github.com/nirholas/pumpkit"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-tg-blue transition"
          >
            <span>⭐</span>
            <span>Star on GitHub</span>
          </a>
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
            >
              ☰
            </button>
          )}
          <div className="w-10 h-10 rounded-full bg-tg-input flex items-center justify-center text-lg">
            {current.emoji}
          </div>
          <div>
            <h1 className="text-[15px] font-medium text-white leading-tight">{current.label}</h1>
            <p className="text-xs text-zinc-500">{current.preview}</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <a
              href="https://github.com/nirholas/pumpkit"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-tg-blue transition text-sm"
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
          <button className="text-zinc-500 hover:text-zinc-300 transition text-xl">😊</button>
          <div className="flex-1 bg-tg-input rounded-full px-4 py-2 text-sm text-zinc-500">
            Message...
          </div>
          <button className="text-zinc-500 hover:text-tg-blue transition text-xl">📎</button>
          <button className="w-9 h-9 rounded-full bg-tg-blue flex items-center justify-center text-white text-sm hover:bg-tg-blue/80 transition">
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}
