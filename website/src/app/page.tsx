'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

const features = [
  {
    icon: '�',
    title: 'Token Creation',
    description: 'Create tokens on the Pump bonding curve with customizable parameters using createV2Instruction.',
  },
  {
    icon: '💰',
    title: 'Buy & Sell Tokens',
    description: 'Trade tokens on the bonding curve with slippage protection and exact-output swaps.',
  },
  {
    icon: '🌉',
    title: 'AMM Migration',
    description: 'Seamless migration from bonding curve to PumpAMM when tokens graduate.',
  },
  {
    icon: '📊',
    title: 'Bonding Curve Math',
    description: 'Precise virtual reserve pricing with BN arithmetic. Never use JavaScript number for financial math.',
  },
  {
    icon: '💸',
    title: 'Fee Sharing',
    description: 'Creator fee sharing with configurable BPS shares. Claim and manage fee distributions.',
  },
  {
    icon: '🏆',
    title: 'Token Incentives',
    description: 'Volume-based token rewards for creators and traders on the Pump protocol.',
  },
  {
    icon: '🔑',
    title: 'Vanity Addresses',
    description: 'Generate custom Solana addresses with prefixes and suffixes using Rust, TypeScript, or Shell.',
  },
  {
    icon: '🤖',
    title: 'MCP Server',
    description: 'Model Context Protocol server for AI agent integration with all SDK tools.',
  },
];

const stats = [
  { label: 'Programs', value: '3', detail: 'Pump · PumpAMM · PumpFees' },
  { label: 'Pattern', value: 'Offline', detail: 'Instruction builders' },
  { label: 'Math', value: 'BN.js', detail: 'No floating point' },
  { label: 'License', value: 'MIT', detail: 'Open source' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.5, ease: 'easeOut' },
  }),
};

export default function HomePage() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center justify-center px-4">
        {/* Subtle radial glow — Ultramarine */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 border border-border rounded-full text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-good animate-pulse" />
              Community PumpFun SDK for Solana
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              <span className="text-gradient">Pump Fun</span>
              <br />
              <span className="text-gradient-solana">SDK</span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              The community TypeScript SDK for the Pump protocol on Solana.
              Create, buy, sell, and migrate tokens with bonding curve pricing,
              AMM pools, fee sharing, and token incentives.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/tools"
                className="px-6 py-3 bg-accent text-white font-semibold text-sm rounded-lair hover:brightness-110 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Launch Tools →
              </Link>
              <a
                href="https://github.com/nirholas/pump-fun-sdk"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 border border-border text-primary-foreground font-semibold text-sm rounded-lair hover:bg-dark-700 transition-all"
              >
                View Source
              </a>
            </div>
          </motion.div>

          {/* Terminal preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
            className="mt-16 max-w-2xl mx-auto"
          >
            <div className="border border-border rounded-lair overflow-hidden bg-dark-800">
              <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border bg-dark-900">
                <div className="w-2.5 h-2.5 rounded-full bg-bad/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-accent/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-good/40" />
                <span className="ml-2 text-xs text-muted font-mono">terminal</span>
              </div>
              <div className="p-4 font-mono text-sm leading-relaxed text-left">
                <div className="text-muted-foreground">
                  <span className="text-good">$</span> npm install @pump-fun/pump-sdk
                </div>
                <div className="mt-2 text-muted">+ @pump-fun/pump-sdk@1.0.0</div>
                <div className="text-muted">added 42 packages in 3.2s</div>
                <div className="mt-2 text-good">✓ Ready to use!</div>
                <div className="text-primary-foreground mt-1">
                  import {'{'} <span className="text-accent">PUMP_SDK</span> {'}'} from{' '}
                  <span className="text-good">'@pump-fun/pump-sdk'</span>
                </div>
                <div className="text-muted mt-1">// Build instructions offline, sign & send</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-dark-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="text-center"
            >
              <div className="text-2xl sm:text-3xl font-bold text-accent-hover">{stat.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              <div className="text-xs text-muted mt-0.5">{stat.detail}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gradient mb-4">
            Everything You Need
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Complete SDK for the Pump protocol covering token lifecycle,
            bonding curves, AMM pools, fees, and more.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
            >
              <Link
                href="/tools"
                className="block h-full p-5 border border-border rounded-lair bg-dark-800/30 hover:bg-dark-700/50 hover:border-accent/30 transition-all group"
              >
                <div className="text-2xl mb-3">{feature.icon}</div>
                <h3 className="text-sm font-semibold text-primary-foreground mb-2 group-hover:text-accent transition-colors">
                  {feature.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Security section */}
      <section className="border-y border-border bg-dark-800/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gradient mb-4">
              Security First
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Built on Solana Labs libraries. Offline-first instruction
              builders that never touch your private keys.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              {
                lib: 'solana-sdk',
                repo: 'solana-labs/solana',
                lang: 'Rust',
              },
              {
                lib: '@solana/web3.js',
                repo: 'solana-labs/solana-web3.js',
                lang: 'TypeScript',
              },
              {
                lib: 'solana-keygen',
                repo: 'solana-labs/solana',
                lang: 'Shell',
              },
            ].map((item, i) => (
              <motion.div
                key={item.lib}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="p-4 border border-border rounded-lair bg-dark-800/50 text-center"
              >
                <div className="text-xs text-accent font-mono mb-1">{item.lang}</div>
                <div className="text-sm font-semibold text-primary-foreground font-mono">{item.lib}</div>
                <div className="text-xs text-muted mt-1">{item.repo}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Difficulty table */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gradient mb-4">
            Vanity Address Difficulty
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Solana addresses use Base58 encoding (58 characters per position).
            Longer patterns take exponentially more time.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto border border-border rounded-lair overflow-hidden"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-dark-800">
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-medium uppercase">
                  Characters
                </th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-medium uppercase">
                  Difficulty
                </th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-medium uppercase">
                  Est. Time (8 cores)
                </th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {[
                ['1', '1 in 58', 'Instant'],
                ['2', '1 in 3,364', '< 1 second'],
                ['3', '1 in 195,112', '~2 seconds'],
                ['4', '1 in 11,316,496', '~2 minutes'],
                ['5', '1 in 656,356,768', '~2 hours'],
                ['6', '1 in 38+ billion', '~4 days'],
                ['7+', '1 in 2+ trillion', 'Weeks+'],
              ].map(([chars, diff, time]) => (
                <tr key={chars} className="border-b border-border/50 hover:bg-dark-700/30">
                  <td className="px-4 py-2.5 text-accent font-semibold">{chars}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{diff}</td>
                  <td className="px-4 py-2.5 text-primary-foreground">{time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gradient mb-4">
            Ready to Build?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Install the SDK and start building on the Pump protocol.
            Offline-first, type-safe, and fully open source.
          </p>
          <Link
            href="/tools"
            className="inline-block px-8 py-3 bg-accent text-white font-semibold text-sm rounded-lair hover:brightness-110 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Launch Tools →
          </Link>
        </motion.div>
      </section>
    </div>
  );
}

