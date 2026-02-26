'use client';

import { useState } from 'react';
import { Keypair } from '@solana/web3.js';
import { ExplorerLink } from './ExplorerLink';

export function GenerateWallet() {
  const [result, setResult] = useState<{
    address: string;
    secretKey: string;
  } | null>(null);

  function generate() {
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toBase58();
    const secretKey = JSON.stringify(Array.from(keypair.secretKey));
    setResult({ address, secretKey });
  }

  function download() {
    if (!result) return;
    const blob = new Blob([result.secretKey], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.address}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">
          Generate Random Wallet
        </h3>
        <p className="text-sm text-muted-foreground">
          Generates a new Ed25519 keypair using @solana/web3.js Keypair.generate()
        </p>
      </div>

      <button
        onClick={generate}
        className="px-5 py-2.5 bg-white text-black font-semibold text-sm rounded hover:bg-white/90 transition-all active:scale-[0.98]"
      >
        Generate New Wallet
      </button>

      {result && (
        <div className="space-y-4 p-4 border border-border rounded-lg bg-dark-800/50 animate-fade-in">
          <div className="flex items-center justify-between">
            <ResultField label="Public Key (Address)" value={result.address} />
          </div>
          <ExplorerLink address={result.address} />
          <ResultField label="Secret Key (JSON Array)" value={result.secretKey} />
          <div className="flex gap-2">
            <button
              onClick={download}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded hover:bg-dark-700 transition-colors"
            >
              Download Keypair JSON
            </button>
          </div>
          <p className="text-xs text-muted">
            ⚠ Save this keypair securely. The secret key is needed to sign transactions.
          </p>
        </div>
      )}
    </div>
  );
}

export function ResultField({
  label,
  value,
  success,
}: {
  label: string;
  value: string;
  success?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <div className="text-xs text-muted uppercase tracking-wide mb-1">{label}</div>
      <div className="flex items-start gap-2">
        <div
          className={`flex-1 p-2.5 border border-border rounded font-mono text-xs break-all ${
            success ? 'text-solana-green' : 'text-white'
          }`}
        >
          {value}
        </div>
        <button
          onClick={copy}
          className="shrink-0 px-2 py-2 text-xs border border-border rounded hover:bg-dark-700 transition-colors text-muted-foreground hover:text-white"
        >
          {copied ? '✓' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
