import { Link } from 'react-router-dom';

const features = [
  { emoji: '🔔', title: 'Fee Claim Monitoring', desc: 'Track creator fee claims in real time' },
  { emoji: '🚀', title: 'Token Launch Alerts', desc: 'Instant notifications for new tokens' },
  { emoji: '🎓', title: 'Graduation Detection', desc: 'Know when tokens migrate to AMM' },
  { emoji: '🐋', title: 'Whale Trade Alerts', desc: 'Spot large buys and sells instantly' },
  { emoji: '👑', title: 'CTO Tracking', desc: 'Follow community takeover events' },
  { emoji: '📊', title: 'Leaderboards & PNL', desc: 'Rank traders and track profit/loss' },
];

const packages = [
  { name: '@pumpkit/core', desc: 'Shared framework — bot scaffolding, config, health, logging', ready: true },
  { name: '@pumpkit/monitor', desc: 'All-in-one PumpFun monitor (claims, launches, graduations, whales)', ready: true },
  { name: '@pumpkit/channel', desc: 'Read-only Telegram channel feed (broadcasts token events)', ready: true },
  { name: '@pumpkit/claim', desc: 'Fee claim tracker by token CA or X handle', ready: true },
  { name: '@pumpkit/tracker', desc: 'Group call-tracking bot with leaderboards & PNL cards', ready: true },
];

function IncomingBubble({ children, time }: { children: React.ReactNode; time: string }) {
  return (
    <div className="flex gap-2 max-w-[85%] mr-auto">
      <div className="w-8 h-8 bg-tg-input rounded-full flex items-center justify-center text-sm shrink-0 mt-1">
        🤖
      </div>
      <div>
        <div className="bg-tg-bubble-in rounded-2xl rounded-bl-sm px-4 py-3 text-white">
          <p className="text-tg-blue text-sm font-medium mb-1">PumpKit Bot</p>
          {children}
        </div>
        <p className="text-[11px] text-zinc-500 mt-1 text-right">{time}</p>
      </div>
    </div>
  );
}

function OutgoingBubble({ children, time }: { children: React.ReactNode; time: string }) {
  return (
    <div className="max-w-[85%] ml-auto">
      <div className="bg-tg-bubble rounded-2xl rounded-br-sm px-4 py-3 text-white">
        {children}
      </div>
      <p className="text-[11px] text-zinc-500 mt-1 text-right">{time}</p>
    </div>
  );
}

export function Home() {
  return (
    <div className="flex flex-col gap-3 p-4 max-w-3xl mx-auto pb-20">
      {/* Date separator */}
      <div className="text-center">
        <span className="bg-tg-input/80 text-zinc-400 text-xs px-3 py-1 rounded-full">
          Today
        </span>
      </div>

      {/* 1. Hero Message (outgoing) */}
      <OutgoingBubble time="12:00">
        <p className="text-3xl mb-2">🚀</p>
        <p className="text-lg font-semibold mb-1">
          Build your own PumpFun Telegram bot in hours, not weeks
        </p>
        <p className="text-sm text-zinc-300 mb-3">
          PumpKit is the open-source TypeScript framework for Solana token bots.
        </p>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <a
            href="https://github.com/nirholas/pumpkit"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-tg-input text-tg-blue text-sm rounded-lg px-4 py-2 text-center hover:brightness-110 transition"
          >
            ⭐ Star on GitHub
          </a>
          <Link
            to="/docs"
            className="bg-tg-input text-tg-blue text-sm rounded-lg px-4 py-2 text-center hover:brightness-110 transition"
          >
            📖 Read the Docs
          </Link>
        </div>
      </OutgoingBubble>

      {/* 2. What is PumpKit? (incoming) */}
      <IncomingBubble time="12:01">
        <p className="text-sm leading-relaxed">
          <strong>PumpKit</strong> is an open-source TypeScript framework for building
          production-ready PumpFun Telegram bots on Solana. It handles RPC connections,
          event monitoring, fee tracking, and bot scaffolding — so you can focus on your
          bot&apos;s unique features instead of boilerplate.
        </p>
      </IncomingBubble>

      {/* 3. Feature Grid (outgoing) */}
      <OutgoingBubble time="12:02">
        <p className="text-sm font-medium mb-3 text-zinc-300">✨ What you can build</p>
        <div className="grid grid-cols-2 gap-2">
          {features.map((f) => (
            <div key={f.title} className="bg-tg-bubble-in/60 rounded-lg px-3 py-2">
              <p className="text-base mb-0.5">{f.emoji} <span className="text-sm font-medium">{f.title}</span></p>
              <p className="text-xs text-zinc-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </OutgoingBubble>

      {/* 4. Quick Start Code Snippet (incoming) */}
      <IncomingBubble time="12:03">
        <p className="text-sm mb-2">⚡ Quick start — four commands and you&apos;re live:</p>
        <div className="bg-[#1a2332] rounded-lg p-3 overflow-x-auto">
          <pre className="font-mono text-sm text-zinc-300 whitespace-pre">{`git clone https://github.com/nirholas/pumpkit.git
cd pumpkit && npm install
cp packages/monitor/.env.example packages/monitor/.env
npm run dev --workspace=@pumpkit/monitor`}</pre>
        </div>
      </IncomingBubble>

      {/* 5. Package Cards (outgoing) */}
      <OutgoingBubble time="12:04">
        <p className="text-sm font-medium mb-3 text-zinc-300">📦 Packages</p>
        <div className="flex flex-col gap-2">
          {packages.map((pkg) => (
            <div
              key={pkg.name}
              className="bg-tg-bubble-in/40 border border-tg-border rounded-lg px-3 py-2"
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-mono text-sm font-medium text-tg-blue">{pkg.name}</span>
                <span className="text-xs">
                  {pkg.ready ? '✅ Ready' : '🚧 Soon'}
                </span>
              </div>
              <p className="text-xs text-zinc-400">{pkg.desc}</p>
            </div>
          ))}
        </div>
      </OutgoingBubble>

      {/* 6. CTA Footer (incoming) */}
      <IncomingBubble time="12:05">
        <p className="text-sm mb-3">
          Ready to build? Start with the docs or check out the create coin tutorial →
        </p>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Link
            to="/create"
            className="bg-tg-input text-tg-blue text-sm rounded-lg px-4 py-2 text-center hover:brightness-110 transition"
          >
            Create Coin →
          </Link>
          <Link
            to="/docs"
            className="bg-tg-input text-tg-blue text-sm rounded-lg px-4 py-2 text-center hover:brightness-110 transition"
          >
            View Docs →
          </Link>
        </div>
      </IncomingBubble>
    </div>
  );
}
