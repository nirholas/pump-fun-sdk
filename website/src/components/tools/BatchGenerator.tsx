'use client';

import { useState, useRef, useCallback } from 'react';
import { Keypair } from '@solana/web3.js';
import { isValidBase58, formatNumber } from '@/lib/utils';
import { ResultField } from './GenerateWallet';
import { ExplorerLink } from './ExplorerLink';

export function BatchGenerator() {
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [count, setCount] = useState(3);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState<Array<{ address: string; secretKey: string }>>([]);

  const runningRef = useRef(false);

  const matchesPattern = useCallback(
    (address: string, pre: string, suf: string, ci: boolean) => {
      let addr = address;
      let p = pre;
      let s = suf;
      if (ci) { addr = addr.toLowerCase(); p = p.toLowerCase(); s = s.toLowerCase(); }
      if (p && !addr.startsWith(p)) return false;
      if (s && !addr.endsWith(s)) return false;
      return true;
    },
    []
  );

  function start() {
    if (running) return;
    if (!prefix && !suffix) { setStatus('Please enter a prefix or suffix'); return; }
    if (prefix && !isValidBase58(prefix)) { setStatus('Invalid Base58 prefix'); return; }
    if (suffix && !isValidBase58(suffix)) { setStatus('Invalid Base58 suffix'); return; }

    setRunning(true);
    setResults([]);
    runningRef.current = true;

    const found: Array<{ address: string; secretKey: string }> = [];
    const startTime = performance.now();
    let attempts = 0;
    const batchSize = 100;
    const target = count;

    function search() {
      if (!runningRef.current || found.length >= target) {
        runningRef.current = false;
        setRunning(false);
        const elapsed = (performance.now() - startTime) / 1000;
        setStatus(`Done! Found ${found.length} addresses in ${elapsed.toFixed(2)}s (${formatNumber(attempts)} attempts)`);
        return;
      }

      for (let i = 0; i < batchSize; i++) {
        attempts++;
        const keypair = Keypair.generate();
        const address = keypair.publicKey.toBase58();

        if (matchesPattern(address, prefix, suffix, ignoreCase)) {
          found.push({
            address,
            secretKey: JSON.stringify(Array.from(keypair.secretKey)),
          });
          setResults([...found]);
          if (found.length >= target) {
            runningRef.current = false;
            setRunning(false);
            const elapsed = (performance.now() - startTime) / 1000;
            setStatus(`Done! Found ${found.length}/${target} addresses in ${elapsed.toFixed(2)}s`);
            return;
          }
        }
      }

      const elapsed = (performance.now() - startTime) / 1000;
      const rate = Math.round(attempts / elapsed);
      setStatus(`Mining ${found.length}/${target}... ${formatNumber(attempts)} attempts (~${formatNumber(rate)}/sec)`);
      setTimeout(search, 0);
    }

    setTimeout(search, 10);
  }

  function stop() {
    runningRef.current = false;
    setRunning(false);
    setStatus('Stopped');
  }

  function downloadAll() {
    const data = results.map((r) => ({
      address: r.address,
      keypair: JSON.parse(r.secretKey),
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-${prefix || ''}${suffix || ''}-${results.length}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Batch Generation</h3>
        <p className="text-sm text-muted-foreground">
          Generate multiple vanity addresses with the same pattern at once.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-muted uppercase tracking-wide mb-1.5">Prefix</label>
          <input
            type="text" value={prefix} onChange={(e) => setPrefix(e.target.value)}
            placeholder="e.g., So1" maxLength={5}
            className="w-full px-3 py-2 bg-dark-800 border border-border rounded font-mono text-sm text-white placeholder:text-muted"
          />
        </div>
        <div>
          <label className="block text-xs text-muted uppercase tracking-wide mb-1.5">Suffix</label>
          <input
            type="text" value={suffix} onChange={(e) => setSuffix(e.target.value)}
            placeholder="e.g., xyz" maxLength={5}
            className="w-full px-3 py-2 bg-dark-800 border border-border rounded font-mono text-sm text-white placeholder:text-muted"
          />
        </div>
        <div>
          <label className="block text-xs text-muted uppercase tracking-wide mb-1.5">Count</label>
          <input
            type="number" value={count} min={1} max={20}
            onChange={(e) => setCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
            className="w-full px-3 py-2 bg-dark-800 border border-border rounded font-mono text-sm text-white"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
        <input type="checkbox" checked={ignoreCase} onChange={(e) => setIgnoreCase(e.target.checked)} className="accent-solana" />
        Case-insensitive matching
      </label>

      <div className="flex gap-2">
        <button onClick={start} disabled={running}
          className="px-5 py-2.5 bg-white text-black font-semibold text-sm rounded hover:bg-white/90 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {running ? 'Mining...' : `Generate ${count} Addresses`}
        </button>
        <button onClick={stop}
          className="px-5 py-2.5 border border-border text-white font-semibold text-sm rounded hover:bg-dark-700 transition-colors"
        >
          Stop
        </button>
      </div>

      {status && (
        <p className={`text-sm ${status.startsWith('Done') ? 'text-solana-green' : 'text-muted-foreground'}`}>
          {status}
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">
              Results ({results.length})
            </h4>
            <button onClick={downloadAll}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded hover:bg-dark-700 transition-colors"
            >
              Download All
            </button>
          </div>
          {results.map((r, i) => (
            <div key={i} className="p-3 border border-border rounded-lg bg-dark-800/50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-muted font-mono">#{i + 1}</span>
                <ExplorerLink address={r.address} />
              </div>
              <ResultField label="Address" value={r.address} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
