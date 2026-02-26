'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

const features = [
  {
    icon: '🔑',
    title: 'Vanity Address Generation',
    description: 'Generate Solana addresses with custom prefixes and suffixes. Your OG name on the blockchain.',
  },
  {
    icon: '⚡',
    title: 'Instant Wallet Creation',
    description: 'Generate secure Ed25519 keypairs instantly using official @solana/web3.js.',
  },
  {
    icon: '✍️',
    title: 'Message Signing',
    description: 'Sign and verify messages with Ed25519 signatures. Prove ownership of any address.',
  },
  {
    icon: '🔍',
    title: 'Address Validation',
    description: 'Validate any Solana address format. Check Base58 encoding and key structure.',
  },
  {
    icon: '🔐',
    title: 'Keypair Verification',
    description: 'Full 7-point keypair validation. Verify key-address pairs match correctly.',
  },
  {
    icon: '📊',
    title: 'Difficulty Estimation',
    description: 'Benchmark your device and estimate vanity address mining time before you start.',
  },
  {
    icon: '🔄',
    title: 'Wallet Restore',
    description: 'Restore wallets from JSON arrays or Base58 secret keys. Solana CLI compatible.',
  },
  {
    icon: '🛡️',
    title: '100% Client-Side',
    description: 'All cryptography runs in your browser. No server calls. Fully air-gappable.',
  },
];

const stats = [
  { label: 'Implementations', value: '3', detail: 'Rust · TypeScript · Shell' },
  { label: 'Libraries', value: '100%', detail: 'Official Solana Labs' },
  { label: 'Network Calls', value: '0', detail: 'Fully offline capable' },
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
        {/* Subtle radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-solana/5 blur-[120px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 border border-border rounded-full text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-solana-green animate-pulse" />
              100% Official Solana Labs Libraries
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              <span className="text-gradient">Solana Wallet</span>
              <br />
              <span className="text-gradient-solana">Toolkit</span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              Secure, auditable toolkit for Solana wallet generation and vanity
              addresses. Generate custom wallet addresses, sign messages, and
              manage keys — all client-side.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/tools"
                className="px-6 py-3 bg-white text-black font-semibold text-sm rounded hover:bg-white/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Launch Tools →
              </Link>
              <a
                href="https://github.com/nirholas/solana-wallet-toolkit"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 border border-border text-white font-semibold text-sm rounded hover:bg-dark-700 transition-all"
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
            <div className="border border-border rounded-lg overflow-hidden bg-dark-800">
              <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border bg-dark-900">
                <div className="w-2.5 h-2.5 rounded-full bg-dark-600" />
                <div className="w-2.5 h-2.5 rounded-full bg-dark-600" />
                <div className="w-2.5 h-2.5 rounded-full bg-dark-600" />
                <span className="ml-2 text-xs text-muted font-mono">terminal</span>
              </div>
              <div className="p-4 font-mono text-sm leading-relaxed text-left">
                <div className="text-muted-foreground">
                  <span className="text-solana-green">$</span> solana-vanity --prefix Sol --suffix 99
                </div>
                <div className="mt-2 text-muted">Searching with 8 threads...</div>
                <div className="text-muted">Attempts: 2,847,391 | Rate: 94,213/sec</div>
                <div className="mt-2 text-solana-green">✓ Found match!</div>
                <div className="text-white mt-1">
                  Address: <span className="text-solana">Sol</span>
                  <span className="text-muted-foreground">k7Df...mRx</span>
                  <span className="text-solana">99</span>
                </div>
                <div className="text-muted mt-1">Saved to: Sol...99.json (0600)</div>
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
              <div className="text-2xl sm:text-3xl font-bold text-white">{stat.value}</div>
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
            Every Tool You Need
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Complete Solana wallet toolkit running entirely in your browser.
            No servers. No tracking. No compromise.
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
                className="block h-full p-5 border border-border rounded-lg bg-dark-800/30 hover:bg-dark-700/50 hover:border-dark-600 transition-all group"
              >
                <div className="text-2xl mb-3">{feature.icon}</div>
                <h3 className="text-sm font-semibold text-white mb-2 group-hover:text-solana transition-colors">
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
              Only official Solana Labs libraries touch your keys. The code is
              auditable, open-source, and designed for air-gapped use.
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
                className="p-4 border border-border rounded-lg bg-dark-800/50 text-center"
              >
                <div className="text-xs text-solana font-mono mb-1">{item.lang}</div>
                <div className="text-sm font-semibold text-white font-mono">{item.lib}</div>
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
          className="max-w-2xl mx-auto border border-border rounded-lg overflow-hidden"
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
                  <td className="px-4 py-2.5 text-solana font-semibold">{chars}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{diff}</td>
                  <td className="px-4 py-2.5 text-white">{time}</td>
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
            Ready to Generate?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            All tools run entirely in your browser. No sign-up, no tracking, no
            server-side processing.
          </p>
          <Link
            href="/tools"
            className="inline-block px-8 py-3 bg-white text-black font-semibold text-sm rounded hover:bg-white/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Launch Tools →
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
