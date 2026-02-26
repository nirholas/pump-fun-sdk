import Link from 'next/link';

export default function MCPPage() {
  const tools = [
    { name: 'generate_keypair', desc: 'Generate a new Solana keypair' },
    { name: 'generate_vanity', desc: 'Generate a vanity address with prefix/suffix' },
    { name: 'sign_message', desc: 'Sign a message with a keypair' },
    { name: 'verify_signature', desc: 'Verify a message signature' },
    { name: 'validate_address', desc: 'Validate a Solana address format' },
    { name: 'estimate_vanity_time', desc: 'Estimate time to find a vanity address' },
    { name: 'restore_keypair', desc: 'Restore keypair from seed phrase or private key' },
  ];

  const resources = [
    { uri: 'solana://config', desc: 'Server configuration' },
    { uri: 'solana://keypair/{id}', desc: 'Access generated keypairs (public key only)' },
    { uri: 'solana://address/{pubkey}', desc: 'Address information' },
  ];

  const prompts = [
    { name: 'create_wallet', desc: 'Guided wallet creation workflow' },
    { name: 'security_audit', desc: 'Security best practices checklist' },
    { name: 'batch_generate', desc: 'Generate multiple keypairs at once' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-gradient mb-2">
        MCP Server
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        A Model Context Protocol server that exposes Solana wallet operations to AI assistants like Claude.
      </p>

      {/* Installation */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-white mb-4 border-b border-border pb-2">
          Installation
        </h2>
        <div className="space-y-4">
          <pre className="p-4 bg-dark-900 border border-border rounded font-mono text-xs text-muted-foreground overflow-x-auto">
{`cd mcp-server
npm install
npm run build`}
          </pre>
        </div>
      </section>

      {/* Claude Desktop setup */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-white mb-4 border-b border-border pb-2">
          Claude Desktop Setup
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Add this to your Claude Desktop config at{' '}
          <code className="text-solana font-mono text-xs">~/Library/Application Support/Claude/claude_desktop_config.json</code>
          {' '}(macOS) or equivalent:
        </p>
        <pre className="p-4 bg-dark-900 border border-border rounded font-mono text-xs text-muted-foreground overflow-x-auto">
{`{
  "mcpServers": {
    "solana-wallet": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"]
    }
  }
}`}
        </pre>
      </section>

      {/* Available Tools */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-white mb-4 border-b border-border pb-2">
          Available Tools
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-dark-800">
                <th className="px-4 py-2 text-left text-xs text-muted-foreground font-medium uppercase">Tool</th>
                <th className="px-4 py-2 text-left text-xs text-muted-foreground font-medium uppercase">Description</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {tools.map((t) => (
                <tr key={t.name} className="border-t border-border/50">
                  <td className="px-4 py-2 text-solana">{t.name}</td>
                  <td className="px-4 py-2 text-muted-foreground font-sans">{t.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Available Resources */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-white mb-4 border-b border-border pb-2">
          Resources
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-dark-800">
                <th className="px-4 py-2 text-left text-xs text-muted-foreground font-medium uppercase">URI</th>
                <th className="px-4 py-2 text-left text-xs text-muted-foreground font-medium uppercase">Description</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {resources.map((r) => (
                <tr key={r.uri} className="border-t border-border/50">
                  <td className="px-4 py-2 text-solana-green">{r.uri}</td>
                  <td className="px-4 py-2 text-muted-foreground font-sans">{r.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Available Prompts */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-white mb-4 border-b border-border pb-2">
          Prompts
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-dark-800">
                <th className="px-4 py-2 text-left text-xs text-muted-foreground font-medium uppercase">Prompt</th>
                <th className="px-4 py-2 text-left text-xs text-muted-foreground font-medium uppercase">Description</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {prompts.map((p) => (
                <tr key={p.name} className="border-t border-border/50">
                  <td className="px-4 py-2 text-white">{p.name}</td>
                  <td className="px-4 py-2 text-muted-foreground font-sans">{p.desc}</td>
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
        <div className="p-4 border border-red-900/50 rounded-lg bg-dark-800/30 space-y-2">
          <p className="text-sm font-semibold text-red-400">⚠ CRITICAL: This server handles cryptocurrency private keys.</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Private keys are <strong className="text-white">never logged</strong> or persisted to disk</li>
            <li>Keys are <strong className="text-white">zeroized from memory</strong> on shutdown</li>
            <li>All inputs are <strong className="text-white">strictly validated</strong></li>
            <li>Uses official Solana libraries only</li>
          </ul>
        </div>
      </section>

      {/* Protocol */}
      <section>
        <div className="p-4 border border-border rounded-lg bg-dark-800/30 text-xs text-muted-foreground">
          <p>Protocol version: <code className="text-white font-mono">2024-11-05</code></p>
          <p className="mt-1">
            <Link href="https://github.com/nirholas/solana-wallet-toolkit/tree/main/mcp-server" target="_blank" className="text-solana hover:underline">
              View source on GitHub ↗
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
