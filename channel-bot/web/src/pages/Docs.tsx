import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const sections = [
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'packages', label: 'Packages' },
  { id: 'commands', label: 'Bot Commands' },
  { id: 'api', label: 'API' },
  { id: 'documentation', label: 'Documentation' },
  { id: 'guides', label: 'Guides' },
  { id: 'protocol', label: 'Protocol' },
  { id: 'reference', label: 'Reference' },
  { id: 'tutorials', label: 'Tutorials' },
  { id: 'community', label: 'Community' },
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

const docs = [
  { title: 'Getting Started', file: 'getting-started' },
  { title: 'Architecture', file: 'architecture' },
  { title: 'Core API', file: 'core-api' },
  { title: 'Monitor Bot', file: 'monitor-bot' },
  { title: 'Tracker Bot', file: 'tracker-bot' },
  { title: 'Channel Bot Architecture', file: 'channel-bot-architecture' },
  { title: 'SDK Integration', file: 'sdk-integration' },
  { title: 'CLI Guide', file: 'cli-guide' },
  { title: 'Admin Operations', file: 'admin-operations' },
  { title: 'AMM Trading', file: 'amm-trading' },
  { title: 'Analytics', file: 'analytics' },
  { title: 'API Reference', file: 'api-reference' },
  { title: 'Cashback', file: 'cashback' },
  { title: 'DeFi Agents', file: 'defi-agents' },
  { title: 'Deployment', file: 'deployment' },
  { title: 'Development', file: 'development' },
  { title: 'End-to-End Workflow', file: 'end-to-end-workflow' },
  { title: 'Errors', file: 'errors' },
  { title: 'Events Reference', file: 'events-reference' },
  { title: 'Examples', file: 'examples' },
  { title: 'FAQ', file: 'faq' },
  { title: 'Fee Sharing', file: 'fee-sharing' },
  { title: 'Fee Tiers', file: 'fee-tiers' },
  { title: 'Glossary', file: 'glossary' },
  { title: 'npm Packages', file: 'npm-packages' },
  { title: 'Performance', file: 'performance' },
  { title: 'Roadmap', file: 'roadmap' },
  { title: 'RPC Best Practices', file: 'rpc-best-practices' },
  { title: 'Support', file: 'support' },
  { title: 'Testing', file: 'testing' },
  { title: 'Troubleshooting', file: 'troubleshooting' },
  { title: 'Migration', file: 'migration' },
  { title: 'Ecosystem', file: 'ecosystem' },
];

const guides = [
  { title: 'Analytics', file: 'analytics' },
  { title: 'Bonding Curve Math', file: 'bonding-curve-math' },
  { title: 'Cashback', file: 'cashback' },
  { title: 'End-to-End Workflow', file: 'end-to-end-workflow' },
  { title: 'Events Reference', file: 'events-reference' },
  { title: 'Fee Sharing', file: 'fee-sharing' },
  { title: 'Fee Tiers', file: 'fee-tiers' },
  { title: 'Mayhem Mode', file: 'mayhem-mode' },
  { title: 'Security', file: 'security' },
  { title: 'Social Fees', file: 'social-fees' },
  { title: 'Token Incentives', file: 'token-incentives' },
];

const reference = [
  { title: 'Error Reference', file: 'errors' },
  { title: 'Code Examples', file: 'examples' },
  { title: 'Glossary', file: 'glossary' },
  { title: 'RPC Best Practices', file: 'rpc-best-practices' },
];

const protocol = [
  { title: 'Pump Program', desc: 'Bonding curve state, create/buy/sell instructions', file: 'PUMP_PROGRAM_README' },
  { title: 'PumpSwap AMM', desc: 'Pool state, swap/deposit/withdraw', file: 'PUMP_SWAP_README' },
  { title: 'Fee Program', desc: 'Dynamic fee tiers based on market cap', file: 'FEE_PROGRAM_README' },
  { title: 'Creator Fees (Bonding Curve)', desc: 'Creator fee sharing on bonding curve', file: 'PUMP_CREATOR_FEE_README' },
  { title: 'Creator Fees (AMM)', desc: 'Creator fee sharing on AMM pools', file: 'PUMP_SWAP_CREATOR_FEE_README' },
  { title: 'Cashback Rewards', desc: 'Cashback & UserVolumeAccumulator', file: 'PUMP_CASHBACK_README' },
  { title: 'PumpSwap SDK', desc: 'SDK method reference & autocomplete helpers', file: 'PUMP_SWAP_SDK_README' },
  { title: 'Protocol Overview', desc: 'create_v2, Token2022, mayhem mode, social fees', file: 'OVERVIEW' },
  { title: 'CU Optimization FAQ', desc: 'Compute unit tips & PDA bump effects', file: 'FAQ' },
];

const community = [
  { title: 'Adopters', desc: 'Community members using PumpKit in production', file: 'adopters' },
  { title: 'Governance', desc: 'BDFL governance model & decision process', file: 'governance' },
  { title: 'Vision', desc: 'Project vision & AI agent thesis', file: 'vision' },
  { title: 'Article: Pump Fun SDK', desc: 'Deep-dive article about the SDK ecosystem', file: 'article-pump-fun-sdk' },
  { title: 'Solana Docs Reference', desc: '3,800+ Solana documentation links', file: 'solana-official-llms.txt' },
  { title: 'SolanaAppKit', desc: 'Guide to mobile DeFi integration', file: 'solanaappkit' },
];

const tutorials = [
  { num: '01', title: 'Create Your First Token on Pump', file: '01-create-token' },
  { num: '02', title: 'Buy Tokens from the Bonding Curve', file: '02-buy-tokens' },
  { num: '03', title: 'Sell Tokens Back to the Bonding Curve', file: '03-sell-tokens' },
  { num: '04', title: 'Create and Buy in One Transaction', file: '04-create-and-buy' },
  { num: '05', title: 'Bonding Curve Math Deep Dive', file: '05-bonding-curve-math' },
  { num: '06', title: 'Token Migration to PumpAMM', file: '06-migration' },
  { num: '07', title: 'Set Up Creator Fee Sharing', file: '07-fee-sharing' },
  { num: '08', title: 'Token Incentives and Volume Rewards', file: '08-token-incentives' },
  { num: '09', title: 'Understanding the Fee System', file: '09-fee-system' },
  { num: '10', title: 'Working with Pump PDAs', file: '10-working-with-pdas' },
  { num: '11', title: 'Building a Trading Bot', file: '11-trading-bot' },
  { num: '12', title: 'Offline SDK vs Online SDK', file: '12-offline-vs-online' },
  { num: '13', title: 'Generating Vanity Addresses', file: '13-vanity-addresses' },
  { num: '14', title: 'x402 Paywalled APIs with Solana', file: '14-x402-paywalled-apis' },
  { num: '15', title: 'Decoding On-Chain Accounts', file: '15-decoding-accounts' },
  { num: '16', title: 'Monitoring Claims', file: '16-monitoring-claims' },
  { num: '17', title: 'Build a Token Monitoring Website', file: '17-monitoring-website' },
  { num: '18', title: 'Telegram Bot for Pump Tokens', file: '18-telegram-bot' },
  { num: '19', title: 'CoinGecko Integration', file: '19-coingecko-integration' },
  { num: '20', title: 'MCP Server for AI Agents', file: '20-mcp-server-ai-agents' },
  { num: '21', title: 'WebSocket Real-Time Token Feeds', file: '21-websocket-realtime-feeds' },
  { num: '22', title: 'Channel Bot — Telegram Broadcasting', file: '22-channel-bot-setup' },
  { num: '23', title: 'Mayhem Mode Trading', file: '23-mayhem-mode-trading' },
  { num: '24', title: 'Cross-Program Trading (Pump → PumpAMM)', file: '24-cross-program-trading' },
  { num: '25', title: 'DeFi Agents Integration', file: '25-defi-agents-integration' },
  { num: '26', title: 'Live Dashboard Deployment', file: '26-live-dashboard-deployment' },
  { num: '27', title: 'Cashback & Social Fee PDAs', file: '27-cashback-social-fees' },
  { num: '28', title: 'Advanced Analytics & Price Quotes', file: '28-analytics-price-quotes' },
  { num: '29', title: 'Event Parsing & On-Chain Analytics', file: '29-event-parsing-analytics' },
  { num: '30', title: 'Batch Vanity Address Generation with Shell Scripts', file: '30-batch-shell-scripts' },
  { num: '31', title: 'Rust Vanity Generator Deep Dive', file: '31-rust-vanity-deep-dive' },
  { num: '32', title: 'Building Plugins with Plugin Delivery', file: '32-plugin-delivery' },
  { num: '33', title: 'Error Handling & Validation Patterns', file: '33-error-handling-patterns' },
  { num: '34', title: 'AMM Liquidity Operations', file: '34-amm-liquidity-operations' },
  { num: '35', title: 'Admin & Protocol Management', file: '35-admin-protocol-management' },
  { num: '36', title: 'x402 Facilitator — Payment Verification & Settlement', file: '36-x402-facilitator-service' },
  { num: '37', title: 'Security Auditing & Keypair Verification', file: '37-security-auditing-verification' },
  { num: '38', title: 'Testing & Benchmarking Vanity Generators', file: '38-testing-benchmarking' },
  { num: '39', title: 'Channel Bot — AI Summaries & GitHub Enrichment', file: '39-channel-bot-ai-enrichment' },
  { num: '40', title: 'Your First Claim Bot', file: '40-your-first-claim-bot' },
  { num: '41', title: 'Customizing Claim Cards', file: '41-customizing-claim-cards' },
  { num: '42', title: 'Channel Feed Bot', file: '42-channel-feed-bot' },
  { num: '43', title: 'Understanding PumpFun Events', file: '43-understanding-pumpfun-events' },
  { num: '44', title: 'Custom DeFi Agent Definitions & i18n', file: '44-custom-defi-agents-i18n' },
  { num: '45', title: 'Plugin Gateway — Building & Deploying API Handlers', file: '45-plugin-gateway-api-handlers' },
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="absolute top-2 right-2 text-xs bg-tg-input/80 hover:bg-tg-input text-zinc-400 hover:text-tg-blue px-2 py-1 rounded transition"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
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
                  ? 'bg-tg-blue text-white shadow-tg'
                  : 'bg-tg-input text-zinc-400 hover:text-zinc-200 hover:bg-tg-hover'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4 max-w-3xl mx-auto pb-20 bubble-stagger">
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
          <div className="bg-[#1a2332] rounded-lg p-3 font-mono text-sm text-zinc-300 overflow-x-auto mt-2 relative">
            <CopyButton text={`git clone https://github.com/nirholas/pumpkit.git\ncd pumpkit && npm install`} />
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

        {/* 6. Documentation Index */}
        <BotBubble id="documentation">
          <p className="font-semibold text-base mb-2">📄 Documentation</p>
          <p className="text-sm text-zinc-400 mb-2">All framework docs:</p>
          <div className="grid grid-cols-2 gap-1">
            {docs.map((d) => (
              <Link
                key={d.file}
                to={`/docs/browse/${d.file}`}
                className="text-sm text-tg-blue hover:underline truncate"
              >
                {d.title}
              </Link>
            ))}
          </div>
          <Link to="/docs/browse" className="inline-block mt-3 text-xs text-tg-blue hover:underline">
            Browse all docs →
          </Link>
        </BotBubble>

        {/* 7. Guides */}
        <BotBubble id="guides">
          <p className="font-semibold text-base mb-2">🗺️ Guides</p>
          <p className="text-sm text-zinc-400 mb-2">In-depth protocol and SDK guides:</p>
          <ul className="space-y-1">
            {guides.map((g) => (
              <li key={g.file} className="text-sm">
                <Link
                  to={`/docs/browse/${g.file}`}
                  className="text-tg-blue hover:underline"
                >
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </BotBubble>

        {/* 8. Reference */}
        <BotBubble id="reference">
          <p className="font-semibold text-base mb-2">📋 Reference</p>
          <ul className="space-y-1">
            {reference.map((r) => (
              <li key={r.file} className="text-sm">
                <Link
                  to={`/docs/browse/${r.file}`}
                  className="text-tg-blue hover:underline"
                >
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </BotBubble>

        {/* 8b. Protocol */}
        <BotBubble id="protocol">
          <p className="font-semibold text-base mb-2">⛓️ Pump Protocol Reference</p>
          <p className="text-sm text-zinc-400 mb-2">Official on-chain program documentation:</p>
          <ul className="space-y-2">
            {protocol.map((p) => (
              <li key={p.file} className="text-sm">
                <a
                  href={`https://github.com/nicholasgasior/pump-fun-sdk/blob/main/docs/pump-official/${p.file}.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-tg-blue hover:underline font-medium"
                >
                  {p.title}
                </a>
                <span className="text-zinc-500 ml-1">— {p.desc}</span>
              </li>
            ))}
          </ul>
        </BotBubble>

        {/* 9. Tutorials */}
        <BotBubble id="tutorials">
          <p className="font-semibold text-base mb-2">📚 Tutorials ({tutorials.length})</p>
          <p className="text-sm text-zinc-400 mb-2">Hands-on step-by-step guides:</p>
          <ol className="space-y-1">
            {tutorials.map((t) => (
              <li key={t.num} className="text-sm">
                <span className="text-zinc-500 font-mono">{t.num}.</span>{' '}
                <Link
                  to={`/tutorials/${t.file}`}
                  className="text-tg-blue hover:underline"
                >
                  {t.title}
                </Link>
              </li>
            ))}
          </ol>
          <Link to="/tutorials" className="inline-block mt-3 text-xs text-tg-blue hover:underline">
            View all {tutorials.length} tutorials →
          </Link>
        </BotBubble>

        {/* 10b. Community & About */}
        <BotBubble id="community">
          <p className="font-semibold text-base mb-2">🌍 Community & About</p>
          <p className="text-sm text-zinc-400 mb-2">Project governance, ecosystem, and resources:</p>
          <ul className="space-y-2">
            {community.map((c) => (
              <li key={c.file} className="text-sm">
                <Link
                  to={`/docs/browse/${c.file}`}
                  className="text-tg-blue hover:underline font-medium"
                >
                  {c.title}
                </Link>
                <span className="text-zinc-500 ml-1">— {c.desc}</span>
              </li>
            ))}
          </ul>
        </BotBubble>

        {/* 11. FAQ */}
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
              className="bg-tg-input text-tg-blue text-xs rounded-lg px-3 py-1.5 text-center hover:brightness-125 transition active:scale-[0.98]"
            >
              ⭐ GitHub
            </a>
            <a
              href="https://github.com/nirholas/pumpkit/discussions"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-tg-input text-tg-blue text-xs rounded-lg px-3 py-1.5 text-center hover:brightness-125 transition active:scale-[0.98]"
            >
              💬 Discussions
            </a>
            <Link
              to="/packages"
              className="bg-tg-input text-tg-blue text-xs rounded-lg px-3 py-1.5 text-center hover:brightness-125 transition active:scale-[0.98]"
            >
              📦 Packages
            </Link>

          </div>
        </BotBubble>
      </div>
    </div>
  );
}
