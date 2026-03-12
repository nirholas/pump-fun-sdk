const packages = [
  { name: '@pumpkit/core', description: 'Shared framework — bot scaffolding, config, health, logging', status: 'ready' as const },
  { name: '@pumpkit/monitor', description: 'All-in-one PumpFun monitor (claims, launches, graduations, whales)', status: 'ready' as const },
  { name: '@pumpkit/channel', description: 'Read-only Telegram channel feed (broadcasts token events)', status: 'ready' as const },
  { name: '@pumpkit/claim', description: 'Fee claim tracker by token CA or X handle', status: 'ready' as const },
  { name: '@pumpkit/tracker', description: 'Group call-tracking bot with leaderboards & PNL cards', status: 'ready' as const },
  { name: '@pumpkit/web', description: 'Frontend dashboard and documentation site', status: 'soon' as const },
];

export function Home() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      {/* Hero */}
      <section className="text-center mb-16">
        <h1 className="text-5xl font-bold mb-4">PumpKit</h1>
        <p className="text-xl text-zinc-400 mb-8">
          Open-source framework for building PumpFun Telegram bots on Solana
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="https://github.com/nirholas/pumpkit"
            className="px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-zinc-200 transition"
          >
            GitHub
          </a>
          <a
            href="/dashboard"
            className="px-6 py-3 bg-bg-card border border-border rounded-lg font-medium hover:border-zinc-600 transition"
          >
            Dashboard
          </a>
        </div>
      </section>

      {/* Quick Start */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-4">Quick Start</h2>
        <pre className="bg-bg-card border border-border rounded-lg p-4 overflow-x-auto text-sm font-mono text-zinc-300">
{`git clone https://github.com/nirholas/pumpkit.git
cd pumpkit && npm install
cp packages/monitor/.env.example packages/monitor/.env
# Edit .env with your TELEGRAM_BOT_TOKEN and SOLANA_RPC_URL
npm run dev --workspace=@pumpkit/monitor`}
        </pre>
      </section>

      {/* Packages */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Packages</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {packages.map((pkg) => (
            <div
              key={pkg.name}
              className="bg-bg-card border border-border rounded-lg p-5 hover:border-zinc-600 transition"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-mono text-sm font-bold">{pkg.name}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    pkg.status === 'ready'
                      ? 'bg-accent-green/20 text-accent-green'
                      : 'bg-accent-orange/20 text-accent-orange'
                  }`}
                >
                  {pkg.status === 'ready' ? '✅ Ready' : '🚧 Coming Soon'}
                </span>
              </div>
              <p className="text-sm text-zinc-400">{pkg.description}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-zinc-500 mt-4 text-center">
          npm packages coming soon — see <a href="https://github.com/nirholas/pumpkit/blob/main/docs/npm.md" className="text-accent-blue hover:underline">docs/npm.md</a> for details.
        </p>
      </section>
    </div>
  );
}
