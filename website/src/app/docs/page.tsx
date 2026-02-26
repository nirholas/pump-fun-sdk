import Link from 'next/link';

export default function DocsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-gradient mb-2">
        Documentation
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Everything you need to get started with the Solana Wallet Toolkit.
      </p>

      {/* Quick Start */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-white mb-4 border-b border-border pb-2">
          Quick Start
        </h2>
        <div className="space-y-4">
          <div className="p-4 border border-border rounded-lg bg-dark-800/30">
            <h3 className="text-sm font-semibold text-solana mb-2">
              Web (This Site)
            </h3>
            <p className="text-sm text-muted-foreground">
              Use the{' '}
              <Link href="/tools" className="text-white underline hover:text-solana">
                Tools page
              </Link>{' '}
              directly in your browser. No installation required. All
              cryptography runs client-side.
            </p>
          </div>

          <div className="p-4 border border-border rounded-lg bg-dark-800/30">
            <h3 className="text-sm font-semibold text-solana mb-2">
              Rust CLI (Fastest)
            </h3>
            <pre className="mt-2 p-3 bg-dark-900 border border-border rounded font-mono text-xs text-muted-foreground overflow-x-auto">
{`git clone https://github.com/nirholas/solana-wallet-toolkit.git
cd solana-wallet-toolkit/rust
cargo build --release
./target/release/solana-vanity --prefix Sol`}
            </pre>
          </div>

          <div className="p-4 border border-border rounded-lg bg-dark-800/30">
            <h3 className="text-sm font-semibold text-solana mb-2">
              TypeScript / Node.js
            </h3>
            <pre className="mt-2 p-3 bg-dark-900 border border-border rounded font-mono text-xs text-muted-foreground overflow-x-auto">
{`cd solana-wallet-toolkit/typescript
npm install && npm run build
node dist/index.js --prefix ABC`}
            </pre>
          </div>

          <div className="p-4 border border-border rounded-lg bg-dark-800/30">
            <h3 className="text-sm font-semibold text-solana mb-2">
              Shell Scripts
            </h3>
            <pre className="mt-2 p-3 bg-dark-900 border border-border rounded font-mono text-xs text-muted-foreground overflow-x-auto">
{`# Requires Solana CLI tools installed
cd solana-wallet-toolkit/scripts
chmod +x *.sh
./generate-vanity.sh Sol`}
            </pre>
          </div>
        </div>
      </section>

      {/* CLI Reference */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-white mb-4 border-b border-border pb-2">
          CLI Reference
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-dark-800">
                <th className="px-4 py-2 text-left text-xs text-muted-foreground font-medium uppercase">
                  Flag
                </th>
                <th className="px-4 py-2 text-left text-xs text-muted-foreground font-medium uppercase">
                  Description
                </th>
                <th className="px-4 py-2 text-left text-xs text-muted-foreground font-medium uppercase">
                  Example
                </th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {[
                ['--prefix, -p', 'Address prefix', '--prefix Sol'],
                ['--suffix, -s', 'Address suffix', '--suffix 99'],
                ['--ignore-case, -i', 'Case-insensitive', '--ignore-case'],
                ['--threads', 'Thread count', '--threads 8'],
                ['--output, -o', 'Output file', '--output wallet.json'],
                ['--count', 'Generate multiple', '--count 5'],
                ['--dry-run', 'Estimate only', '--dry-run'],
                ['--quiet', 'Minimal output', '--quiet'],
              ].map(([flag, desc, example]) => (
                <tr key={flag} className="border-t border-border/50">
                  <td className="px-4 py-2 text-solana">{flag}</td>
                  <td className="px-4 py-2 text-muted-foreground">{desc}</td>
                  <td className="px-4 py-2 text-white">{example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Security */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-white mb-4 border-b border-border pb-2">
          Security
        </h2>
        <div className="space-y-3">
          {[
            {
              title: 'Official Libraries Only',
              desc: 'All Ed25519 key generation uses solana-sdk (Rust) and @solana/web3.js (TypeScript) from Solana Labs.',
            },
            {
              title: 'Run Offline',
              desc: 'Disconnect from the internet before generating wallets. This toolkit makes zero network calls.',
            },
            {
              title: 'Secure File Permissions',
              desc: 'Keypair files are saved with 0600 permissions (owner read/write only).',
            },
            {
              title: 'Memory Zeroization',
              desc: 'The Rust implementation uses the zeroize crate to clear private keys from memory.',
            },
            {
              title: 'Audit the Code',
              desc: 'The source code is open, documented, and designed to be auditable. Read it yourself.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="p-4 border border-border rounded-lg bg-dark-800/30"
            >
              <h3 className="text-sm font-semibold text-white mb-1">
                {item.title}
              </h3>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-white mb-4 border-b border-border pb-2">
          How It Works
        </h2>
        <div className="p-4 border border-border rounded-lg bg-dark-800/30">
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>
              Generate random Ed25519 keypair using{' '}
              <code className="text-solana font-mono text-xs">solana-sdk</code> /{' '}
              <code className="text-solana font-mono text-xs">@solana/web3.js</code>
            </li>
            <li>Get the public key (32 bytes)</li>
            <li>Encode as Base58 string (Solana address format)</li>
            <li>Check if address matches the desired pattern</li>
            <li>Repeat until a match is found</li>
            <li>Save keypair in Solana CLI JSON format (64-byte array)</li>
          </ol>
        </div>
      </section>

      {/* Output format */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-white mb-4 border-b border-border pb-2">
          Output Format
        </h2>
        <div className="p-4 border border-border rounded-lg bg-dark-800/30">
          <p className="text-sm text-muted-foreground mb-3">
            Keypairs are saved in Solana CLI JSON format — a JSON array of 64
            bytes (32 secret + 32 public):
          </p>
          <pre className="p-3 bg-dark-900 border border-border rounded font-mono text-xs text-muted-foreground overflow-x-auto">
            {`[174,47,154,16,202,193,206,113,199,190,53,133,169,175,31,56,...]`}
          </pre>
          <p className="text-xs text-muted mt-3">
            Compatible with{' '}
            <code className="text-white">solana config set --keypair</code> and
            other Solana CLI tools.
          </p>
        </div>
      </section>

      {/* Comparison table */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4 border-b border-border pb-2">
          Comparison
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          How this toolkit compares to other Solana vanity address tools:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-dark-800">
                <th className="px-4 py-2 text-left text-xs text-muted-foreground font-medium uppercase">Feature</th>
                <th className="px-4 py-2 text-left text-xs text-muted-foreground font-medium uppercase">This Toolkit</th>
                <th className="px-4 py-2 text-left text-xs text-muted-foreground font-medium uppercase">solana-keygen grind</th>
                <th className="px-4 py-2 text-left text-xs text-muted-foreground font-medium uppercase">Other Tools</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {[
                ['Official Libraries', '✅ solana-sdk + @solana/web3.js', '✅ solana-sdk', '❌ Often custom/unknown'],
                ['Implementations', '4 (Rust, TS, Shell, Web)', '1 (Rust CLI)', 'Usually 1'],
                ['Multi-threaded', '✅ All CPU cores', '✅ Yes', 'Varies'],
                ['Prefix Search', '✅ Yes', '✅ Yes', '✅ Usually'],
                ['Suffix Search', '✅ Yes', '❌ No', 'Varies'],
                ['Case-Insensitive', '✅ Yes', '❌ No', 'Rarely'],
                ['Difficulty Estimation', '✅ Built-in', '❌ No', 'Rarely'],
                ['Solana CLI Compatible', '✅ Yes (64-byte JSON)', '✅ Yes', 'Varies'],
                ['Browser-based', '✅ This website', '❌ No', 'Some (risky)'],
                ['MCP Server', '✅ For AI agents', '❌ No', '❌ No'],
                ['Open Source', '✅ MIT License', '✅ Apache 2.0', 'Varies'],
                ['Memory Zeroization', '✅ zeroize crate', '✅ Yes', '❌ Rarely'],
              ].map(([feature, us, keygen, others]) => (
                <tr key={feature} className="border-t border-border/50">
                  <td className="px-4 py-2 text-white font-medium">{feature}</td>
                  <td className="px-4 py-2 text-solana-green">{us}</td>
                  <td className="px-4 py-2 text-muted-foreground">{keygen}</td>
                  <td className="px-4 py-2 text-muted-foreground">{others}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
