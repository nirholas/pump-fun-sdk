'use client';

import { useState, useRef, useCallback } from 'react';
import { Keypair } from '@solana/web3.js';
import { isValidBase58, formatNumber } from '@/lib/utils';
import { ResultField } from './GenerateWallet';
import { ExplorerLink } from './ExplorerLink';

export function VanityGenerator() {
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<{
    address: string;
    secretKey: string;
  } | null>(null);

  const runningRef = useRef(false);

  const matchesPattern = useCallback(
    (address: string, pre: string, suf: string, ci: boolean) => {
      let addr = address;
      let p = pre;
      let s = suf;
      if (ci) {
        addr = addr.toLowerCase();
        p = p.toLowerCase();
        s = s.toLowerCase();
      }
      if (p && !addr.startsWith(p)) return false;
      if (s && !addr.endsWith(s)) return false;
      return true;
    },
    []
  );

  function start() {
    if (running) return;
    if (!prefix && !suffix) {
      setStatus('Please enter a prefix or suffix');
      return;
    }
    if (prefix && !isValidBase58(prefix)) {
      setStatus('Prefix contains invalid Base58 characters');
      return;
    }
    if (suffix && !isValidBase58(suffix)) {
      setStatus('Suffix contains invalid Base58 characters');
      return;
    }

    setRunning(true);
    setResult(null);
    runningRef.current = true;

    const startTime = performance.now();
    let attempts = 0;
    const batchSize = 100;

    function search() {
      if (!runningRef.current) {
        setRunning(false);
        return;
      }

      for (let i = 0; i < batchSize; i++) {
        attempts++;
        const keypair = Keypair.generate();
        const address = keypair.publicKey.toBase58();

        if (matchesPattern(address, prefix, suffix, ignoreCase)) {
          runningRef.current = false;
          setRunning(false);
          const elapsed = (performance.now() - startTime) / 1000;
          const rate = Math.round(attempts / elapsed);
          setStatus(
            `✅ Found in ${formatNumber(attempts)} attempts (${elapsed.toFixed(2)}s, ${formatNumber(rate)}/sec)`
          );
          setResult({
            address,
            secretKey: JSON.stringify(Array.from(keypair.secretKey)),
          });
          return;
        }
      }

      const elapsed = (performance.now() - startTime) / 1000;
      const rate = Math.round(attempts / elapsed);
      setStatus(
        `Mining... ${formatNumber(attempts)} attempts (${elapsed.toFixed(1)}s, ~${formatNumber(rate)}/sec)`
      );
      setTimeout(search, 0);
    }

    setTimeout(search, 10);
  }

  function stop() {
    runningRef.current = false;
    setRunning(false);
    setStatus('Stopped');
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
          Vanity Address Generator
        </h3>
        <p className="text-sm text-muted-foreground">
          Generate addresses with custom prefixes/suffixes. Solana addresses use
          Base58 encoding.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted uppercase tracking-wide mb-1.5">
            Prefix (start of address)
          </label>
          <input
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="e.g., So1"
            maxLength={6}
            className="w-full px-3 py-2 bg-dark-800 border border-border rounded font-mono text-sm text-white placeholder:text-muted"
          />
        </div>
        <div>
          <label className="block text-xs text-muted uppercase tracking-wide mb-1.5">
            Suffix (end of address)
          </label>
          <input
            type="text"
            value={suffix}
            onChange={(e) => setSuffix(e.target.value)}
            placeholder="e.g., xyz"
            maxLength={6}
            className="w-full px-3 py-2 bg-dark-800 border border-border rounded font-mono text-sm text-white placeholder:text-muted"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={ignoreCase}
          onChange={(e) => setIgnoreCase(e.target.checked)}
          className="accent-solana"
        />
        Case-insensitive matching
      </label>

      <div className="flex gap-2">
        <button
          onClick={start}
          disabled={running}
          className="px-5 py-2.5 bg-white text-black font-semibold text-sm rounded hover:bg-white/90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? 'Mining...' : 'Start Mining'}
        </button>
        <button
          onClick={stop}
          className="px-5 py-2.5 border border-border text-white font-semibold text-sm rounded hover:bg-dark-700 transition-colors"
        >
          Stop
        </button>
      </div>

      {status && (
        <p className={`text-sm ${status.startsWith('✅') ? 'text-solana-green' : 'text-muted-foreground'}`}>
          {status}
        </p>
      )}

      {result && (
        <div className="space-y-4 p-4 border border-border rounded-lg bg-dark-800/50 animate-fade-in">
          <ResultField label="Public Key (Address)" value={result.address} />
          <ExplorerLink address={result.address} />
          <ResultField label="Secret Key (JSON Array)" value={result.secretKey} />
          <button
            onClick={download}
            className="px-3 py-1.5 text-xs font-medium border border-border rounded hover:bg-dark-700 transition-colors"
          >
            Download Keypair JSON
          </button>
        </div>
      )}
    </div>
  );
}
