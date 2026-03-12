import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const sections = [
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'packages', label: 'Packages' },
  { id: 'commands', label: 'Bot Commands' },
  { id: 'api', label: 'API' },
  { id: 'tutorials', label: 'Tutorials' },
  { id: 'faq', label: 'FAQ' },
];

const packages = [
  {
    name: '@pumpkit/core',
    desc: 'Shared framework: bot scaffolding, Solana monitoring, formatters, storage, config, health checks',
    features: ['Bot lifecycle management', 'Solana RPC helpers', 'Message formatters', 'SQLite storage layer', 'Config & health checks'],
  },
  {
    name: '@pumpkit/monitor',
    desc: 'All-in-one PumpFun monitor: fee claims, launches, graduations, whale trades, CTO alerts. Includes REST API + SSE streaming',
    features: ['Fee claim detection', 'Token launch alerts', 'Graduation tracking', 'Whale trade notifications', 'REST API + SSE'],
  },
  {
    name: '@pumpkit/channel',
    desc: 'Read-only Telegram channel feed that broadcasts token events',
    features: ['Auto-post to channels', 'Configurable event types', 'Rich message formatting'],
  },
  {
    name: '@pumpkit/claim',
    desc: 'Fee claim tracker: look up claims by token CA or creator\'s X/Twitter handle',
    features: ['Lookup by contract address', 'Lookup by X/Twitter handle', 'Claim history & totals'],
  },
  {
    name: '@pumpkit/tracker',
    desc: 'Group call-tracking bot with leaderboards, PNL cards, and multi-chain support',
    features: ['Group call tracking', 'PNL cards & reports', 'Leaderboard rankings', 'Multi-chain support'],
  },
];

const apiEndpoints = [
  { method: 'GET', path: '/api/v1/health', desc: 'Bot status, uptime' },
  { method: 'GET', path: '/api/v1/watches', desc: 'List watched wallets' },
  { method: 'POST', path: '/api/v1/watches', desc: 'Add a watch' },
  { method: 'DEL', path: '/api/v1/watches/:addr', desc: 'Remove a watch' },
  { method: 'GET', path: '/api/v1/claims', desc: 'Recent claims (paginated)' },
  { method: 'GET', path: '/api/v1/claims/stream', desc: 'SSE real-time stream' },
  { method: 'POST', path: '/api/v1/webhooks', desc: 'Register webhook' },
  { method: 'DEL', path: '/api/v1/webhooks/:id', desc: 'Remove webhook' },
];

const faqs = [
  { q: 'Is PumpKit free to use?', a: 'Yes! PumpKit is MIT licensed. Use it for personal or commercial projects.' },
  { q: 'Does it work with PumpSwap?', a: 'Yes. The monitor detects token graduations and can track AMM pool activity via @pumpkit/core.' },
  { q: 'Can I run multiple bots?', a: 'Absolutely. Each package is independent. Run monitor, tracker, and channel bots simultaneously.' },
];

const tutorials = [
  { title: 'Set up your first monitor bot', anchor: 'getting-started' },
  { title: 'Deploy to Railway in 5 minutes', anchor: 'architecture' },
  { title: 'Add custom event handlers', anchor: 'api' },
  { title: 'Build a channel feed bot', anchor: 'packages' },
  { title: 'Create a call-tracking group bot', anchor: 'commands' },
  { title: 'Integrate with PumpFun SDK', anchor: 'packages' },
];

const commands = [
  { cmd: '/start', desc: 'Start the bot & show welcome' },
  { cmd: '/help', desc: 'Show all commands' },
  { cmd: '/watch CA', desc: 'Watch a wallet for fee claims' },
  { cmd: '/unwatch CA', desc: 'Stop watching a wallet' },
  { cmd: '/list', desc: 'Show watched wallets' },
  { cmd: '/claims', desc: 'Recent claim events' },
  { cmd: '/status', desc: 'Bot health & uptime' },
  { cmd: '/alerts', desc: 'Configure alert settings' },
];

function methodColor(method: string) {
  if (method === 'GET') return 'text-pump-green';
  if (method === 'POST') return 'text-tg-blue';
  return 'text-pump-pink';
}

function BotBubble({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <>
      {id && <div id={id} className="pt-4" />}
      <div className="flex gap-2 items-start max-w-[85%] mr-auto">
        <div className="w-8 h-8 rounded-full bg-tg-input flex items-center justify-center text-sm shrink-0 mt-1">
          📖
        </div>
        <div className="bg-tg-bubble-in rounded-2xl rounded-bl-sm px-4 py-3 text-white flex-1 min-w-0">
          <p className="text-tg-blue text-sm font-medium mb-1">PumpKit Docs</p>
          {children}
        </div>
      </div>
    </>
  );
}

function OutBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-tg-bubble rounded-2xl rounded-br-sm max-w-[85%] ml-auto px-4 py-3 text-white">
      {children}
    </div>
  );
}

export function Docs() {
  const [activeSection, setActiveSection] = useState('getting-started');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observerRef.current.observe(el);
    }
    return () => observerRef.current?.disconnect();
  }, []);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(id);
  }

  return (
    <div className="relative">
      {/* Sticky TOC */}
      <div className="sticky top-0 z-10 bg-tg-chat/95 backdrop-blur-sm border-b border-tg-border px-4 py-2">
        <div className="flex gap-2 overflow-x-auto max-w-3xl mx-auto scrollbar-none">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition ${
                activeSection === s.id
                  ? 'bg-tg-blue text-white'
                  : 'bg-tg-input text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4 max-w-3xl mx-auto pb-20">
        {/* Date separator */}
        <div className="text-center">
          <span className="bg-tg-input/80 text-zinc-400 text-xs px-3 py-1 rounded-full">
            Documentation
          </span>
        </div>

        {/* 1. Getting Started */}
        <BotBubble id="getting-started">
          <p className="font-semibold text-base mb-2">📖 Getting Started</p>
          <p className="text-sm text-zinc-300 leading-relaxed mb-3">
            PumpKit is an open-source TypeScript framework for building PumpFun
            Telegram bots on Solana. It provides production-ready building blocks
            so you can ship a bot in hours, not weeks.
          </p>
          <p className="text-sm font-medium mb-1">Prerequisites:</p>
          <ul className="text-sm text-zinc-300 mb-3 space-y-0.5">
            <li>• Node.js ≥ 20</li>
            <li>• A Telegram Bot Token (from @BotFather)</li>
            <li>• A Solana RPC URL (Helius, Quicknode, etc.)</li>
          </ul>
          <p className="text-sm font-medium mb-1">Installation:</p>
          <div className="bg-[#1a2332] rounded-lg p-3 font-mono text-sm text-zinc-300 overflow-x-auto mt-2">
            <pre className="whitespace-pre">{`git clone https://github.com/nirholas/pumpkit.git
cd pumpkit && npm install`}</pre>
          </div>
        </BotBubble>

        {/* 2. Architecture */}
        <BotBubble id="architecture">
          <p className="font-semibold text-base mb-2">🏗️ Architecture</p>
          <p className="text-sm text-zinc-300 mb-2">
            PumpKit is a monorepo with a shared core and specialized bot packages:
          </p>
          <div className="bg-[#1a2332] rounded-lg p-3 overflow-x-auto mt-2">
            <pre className="font-mono text-xs text-zinc-300 whitespace-pre">{`┌───────────────────────────────────────────────┐
│                @pumpkit/core                  │
│  bot/ • monitor/ • solana/ • formatter/       │
│  storage/ • config/ • health/ • logger/       │
└──────┬──────────────────┬─────────────────────┘
       │                  │
 ┌─────▼──────┐    ┌──────▼──────┐
 │  monitor   │    │  tracker    │
 │ DM + API   │    │ Groups +   │
 │ Channel    │    │ Leaderboard │
 └────────────┘    └─────────────┘`}</pre>
          </div>
        </BotBubble>

        {/* 3. Packages */}
        <div id="packages" className="pt-4" />
        {packages.map((pkg) => (
          <BotBubble key={pkg.name}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-tg-blue font-bold text-sm">{pkg.name}</span>
              <span className="text-xs">✅ Ready</span>
            </div>
            <p className="text-sm text-zinc-300 mb-2">{pkg.desc}</p>
            <ul className="text-xs text-zinc-400 space-y-0.5">
              {pkg.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
          </BotBubble>
        ))}

        {/* 4. Bot Commands */}
        <BotBubble id="commands">
          <p className="font-semibold text-base mb-2">🤖 Monitor Bot Commands</p>
          <div className="space-y-1">
            {commands.map((c) => (
              <div key={c.cmd} className="flex gap-2 text-sm">
                <span className="font-mono text-tg-blue shrink-0 w-28">{c.cmd}</span>
                <span className="text-zinc-400">— {c.desc}</span>
              </div>
            ))}
          </div>
        </BotBubble>

        {/* 5. API Reference */}
        <BotBubble id="api">
          <p className="font-semibold text-base mb-2">📡 Monitor API Endpoints</p>
          <div className="space-y-1">
            {apiEndpoints.map((ep) => (
              <div key={`${ep.method}-${ep.path}`} className="flex gap-2 text-sm font-mono">
                <span className={`shrink-0 w-10 ${methodColor(ep.method)}`}>{ep.method}</span>
                <span className="text-zinc-300 shrink-0">{ep.path}</span>
                <span className="text-zinc-500 font-sans">→ {ep.desc}</span>
              </div>
            ))}
          </div>
        </BotBubble>

        {/* 6. Tutorials */}
        <BotBubble id="tutorials">
          <p className="font-semibold text-base mb-2">📚 Tutorials</p>
          <ol className="space-y-1">
            {tutorials.map((t, i) => (
              <li key={t.anchor} className="text-sm">
                <span className="text-zinc-500">{i + 1}.</span>{' '}
                <a
                  href={`https://github.com/nirholas/pumpkit/tree/main/docs/tutorials/${(i + 1).toString().padStart(2, '0')}-${t.title.toLowerCase().replace(/\s+/g, '-')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-tg-blue hover:underline"
                >
                  {t.title}
                </a>
              </li>
            ))}
          </ol>
        </BotBubble>

        {/* 7. FAQ */}
        <div id="faq" className="pt-4" />
        <div className="text-center">
          <span className="bg-tg-input/80 text-zinc-400 text-xs px-3 py-1 rounded-full">
            Frequently Asked Questions
          </span>
        </div>
        {faqs.map((faq) => (
          <div key={faq.q} className="flex flex-col gap-2">
            <OutBubble>
              <p className="text-sm">{faq.q}</p>
            </OutBubble>
            <BotBubble>
              <p className="text-sm text-zinc-300">{faq.a}</p>
            </BotBubble>
          </div>
        ))}

        {/* 8. Footer CTA */}
        <BotBubble>
          <p className="font-semibold text-base mb-1">🚀 Ready to start building?</p>
          <p className="text-sm text-zinc-300 mb-3">
            Join the community or dive into the code:
          </p>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <a
              href="https://github.com/nirholas/pumpkit"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-tg-input text-tg-blue text-xs rounded-lg px-3 py-1.5 text-center hover:brightness-110 transition"
            >
              ⭐ GitHub
            </a>
            <a
              href="https://github.com/nirholas/pumpkit/discussions"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-tg-input text-tg-blue text-xs rounded-lg px-3 py-1.5 text-center hover:brightness-110 transition"
            >
              💬 Telegram
            </a>

          </div>
        </BotBubble>
      </div>
    </div>
  );
}
