import { Link } from 'react-router-dom';

const packages = [
  {
    name: '@pumpkit/core',
    emoji: '🧱',
    borderColor: 'border-l-tg-blue',
    description: 'The shared foundation. Every PumpKit bot uses core.',
    features: [
      '🤖 Grammy bot scaffolding + command router',
      '📡 WebSocket + HTTP event monitors',
      '⛓️ Solana RPC client + program decoders',
      '📝 HTML message formatter (Telegram)',
      '💾 File-based + SQLite storage adapters',
      '⚙️ Typed env config with validation',
      '🏥 HTTP health check server',
      '📊 Leveled console logger',
    ],
    install: 'npm install @pumpkit/core',
    code: `import { createBot, createHealthServer } from '@pumpkit/core';

const bot = createBot({
  token: process.env.BOT_TOKEN!,
  commands: { start: (ctx) => ctx.reply('Hello!') },
});`,
  },
  {
    name: '@pumpkit/monitor',
    emoji: '📡',
    borderColor: 'border-l-pump-green',
    description: 'All-in-one PumpFun activity monitor. DM bot + REST API + SSE streaming.',
    features: [
      '💰 Fee claims (by wallet or token)',
      '🚀 Token launches (with cashback detection)',
      '🎓 Graduations (bonding curve → AMM)',
      '🐋 Whale trades (configurable threshold)',
      '👑 CTO events (creator transfers)',
      '💎 Fee distributions',
    ],
    extras: [
      'API: REST endpoints + SSE real-time stream',
      'Deploy: Railway, Fly.io, or any Node.js host',
    ],
  },
  {
    name: '@pumpkit/channel',
    emoji: '📢',
    borderColor: 'border-l-pump-cyan',
    description: 'Read-only Telegram channel feed. Broadcasts token events to a public channel.',
    features: [
      'Zero interaction needed — just add the bot as channel admin',
      'Customizable message templates',
      'Filter by event type',
      'Rate limiting built in',
    ],
  },
  {
    name: '@pumpkit/claim',
    emoji: '💰',
    borderColor: 'border-l-pump-yellow',
    description: 'Fee claim tracker. Look up claims by token CA or creator X handle.',
    features: [
      '/claim <CA> — show fee claims for a token',
      '/creator <handle> — find tokens by X/Twitter handle',
      'CSV export for accounting',
      'Historical claim data',
    ],
  },
  {
    name: '@pumpkit/tracker',
    emoji: '🏆',
    borderColor: 'border-l-pump-purple',
    description: 'Group call-tracking bot. Add to your Telegram group, members call tokens, bot tracks results.',
    features: [
      '📊 Leaderboards (daily/weekly/monthly/all-time)',
      '💰 PNL cards with entry/exit prices',
      '🏅 Rank tiers (Amateur → Oracle)',
      '⛓️ Multi-chain (Solana, ETH, Base, BSC)',
      '📈 Win rate & multiplier tracking',
      '🎯 Call resolution (auto or manual)',
    ],
  },
];

export function Packages() {
  return (
    <div className="flex flex-col gap-4 p-4 max-w-3xl mx-auto pb-24">
      {/* Date separator */}
      <div className="text-center py-2">
        <span className="bg-tg-input/80 text-zinc-400 text-xs px-3 py-1 rounded-full">
          Packages
        </span>
      </div>

      {/* Overview message */}
      <div className="flex items-start gap-2 max-w-[85%]">
        <div className="w-8 h-8 rounded-full bg-tg-input flex items-center justify-center text-sm shrink-0">
          📦
        </div>
        <div>
          <span className="text-sm font-medium text-tg-blue">PumpKit</span>
          <div className="bg-tg-bubble-in rounded-2xl rounded-tl-sm px-4 py-2.5 mt-1">
            <p className="text-sm text-zinc-200">
              PumpKit ships 5 packages. Each is independent — use what you need.
            </p>
            <p className="text-xs text-zinc-500 mt-2">
              5 packages • TypeScript • MIT License • Node.js ≥ 20
            </p>
          </div>
        </div>
      </div>

      {/* Package cards */}
      {packages.map((pkg) => (
        <div key={pkg.name} className="flex items-start gap-2 max-w-[85%]">
          <div className="w-8 h-8 rounded-full bg-tg-input flex items-center justify-center text-sm shrink-0">
            {pkg.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-tg-blue">PumpKit</span>
            <div className={`bg-tg-bubble-in rounded-2xl rounded-tl-sm px-4 py-3 mt-1 border-l-4 ${pkg.borderColor}`}>
              <p className="text-sm font-semibold text-zinc-100">
                {pkg.emoji} {pkg.name}
              </p>
              <p className="text-sm text-zinc-300 mt-2">{pkg.description}</p>

              <div className="mt-3 space-y-0.5">
                <p className="text-xs text-zinc-400 font-medium">
                  {pkg.name === '@pumpkit/monitor' ? 'Monitors:' : 'Features:'}
                </p>
                {pkg.features.map((f, i) => {
                  const isTree = pkg.features.length > 3;
                  const prefix = !isTree
                    ? '•'
                    : i === pkg.features.length - 1
                      ? '└─'
                      : '├─';
                  return (
                    <p key={i} className="text-xs text-zinc-400 font-mono">
                      {prefix} {f}
                    </p>
                  );
                })}
              </div>

              {pkg.extras && (
                <div className="mt-2 space-y-0.5">
                  {pkg.extras.map((e, i) => (
                    <p key={i} className="text-xs text-zinc-400">{e}</p>
                  ))}
                </div>
              )}

              {pkg.install && (
                <p className="text-xs text-zinc-500 mt-3 font-mono">{pkg.install}</p>
              )}

              {pkg.code && (
                <pre className="bg-[#1a2332] rounded-lg p-3 font-mono text-xs text-zinc-300 overflow-x-auto mt-3">
                  <code>{pkg.code}</code>
                </pre>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* CTA — outgoing bubble */}
      <div className="flex justify-end">
        <div className="bg-tg-bubble rounded-2xl rounded-br-sm px-4 py-3 max-w-[85%]">
          <p className="text-sm text-zinc-100">
            Ready to build? Pick a package and start coding.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Link
              to="/docs"
              className="bg-tg-blue/20 text-tg-blue text-xs px-3 py-1.5 rounded-full hover:bg-tg-blue/30 transition"
            >
              📖 Read the Docs
            </Link>

            <a
              href="https://github.com/nirholas/pumpkit"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-tg-blue/20 text-tg-blue text-xs px-3 py-1.5 rounded-full hover:bg-tg-blue/30 transition"
            >
              ⭐ GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
