'use client';

import { useState } from 'react';
import { Keypair } from '@solana/web3.js';
import { isValidBase58, formatNumber, formatDuration } from '@/lib/utils';

export function DifficultyEstimator() {
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [result, setResult] = useState<{
    rate: number;
    expectedAttempts: number;
    expectedSeconds: number;
    patternDesc: string;
    probabilities: Array<{ time: string; prob: string }>;
  } | null>(null);
  const [error, setError] = useState('');
  const [benchmarking, setBenchmarking] = useState(false);

  function runBenchmark() {
    setError('');
    setResult(null);

    if (!prefix && !suffix) {
      setError('Please enter a prefix or suffix');
      return;
    }
    if (prefix && !isValidBase58(prefix)) {
      setError('Prefix contains invalid Base58 characters');
      return;
    }
    if (suffix && !isValidBase58(suffix)) {
      setError('Suffix contains invalid Base58 characters');
      return;
    }

    setBenchmarking(true);

    // Defer to next frame so UI updates
    setTimeout(() => {
      const benchmarkDuration = 1000;
      const startTime = performance.now();
      let count = 0;

      while (performance.now() - startTime < benchmarkDuration) {
        Keypair.generate();
        count++;
      }

      const actualDuration = (performance.now() - startTime) / 1000;
      const rate = Math.round(count / actualDuration);

      const prefixLen = prefix?.length || 0;
      const suffixLen = suffix?.length || 0;
      const effectiveAlphabetSize = ignoreCase ? 34 : 58;

      const prefixDifficulty = Math.pow(effectiveAlphabetSize, prefixLen);
      const suffixDifficulty = Math.pow(effectiveAlphabetSize, suffixLen);
      const totalDifficulty = prefixDifficulty * suffixDifficulty;

      const expectedAttempts = totalDifficulty;
      const expectedSeconds = expectedAttempts / rate;

      const probabilities = [0.5, 1.0, 2.0, 5.0].map((mult) => ({
        time: formatDuration(expectedSeconds * mult),
        prob: ((1 - Math.exp(-mult)) * 100).toFixed(1),
      }));

      const patternDesc = [
        prefix ? `prefix "${prefix}"` : null,
        suffix ? `suffix "${suffix}"` : null,
      ]
        .filter(Boolean)
        .join(' + ');

      setResult({
        rate,
        expectedAttempts,
        expectedSeconds,
        patternDesc: patternDesc + (ignoreCase ? ' (case-insensitive)' : ''),
        probabilities,
      });

      setBenchmarking(false);
    }, 50);
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">
          Difficulty Estimation
        </h3>
        <p className="text-sm text-muted-foreground">
          Benchmark your device and estimate how long a vanity address will take
          to find.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted uppercase tracking-wide mb-1.5">
            Prefix
          </label>
          <input
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="e.g., ABC"
            maxLength={8}
            className="w-full px-3 py-2 bg-dark-800 border border-border rounded font-mono text-sm text-white placeholder:text-muted"
          />
        </div>
        <div>
          <label className="block text-xs text-muted uppercase tracking-wide mb-1.5">
            Suffix
          </label>
          <input
            type="text"
            value={suffix}
            onChange={(e) => setSuffix(e.target.value)}
            placeholder="e.g., xyz"
            maxLength={8}
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

      <button
        onClick={runBenchmark}
        disabled={benchmarking}
        className="px-5 py-2.5 bg-white text-black font-semibold text-sm rounded hover:bg-white/90 transition-all active:scale-[0.98] disabled:opacity-50"
      >
        {benchmarking ? 'Benchmarking...' : 'Run Benchmark & Estimate'}
      </button>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {result && (
        <div className="space-y-4 p-4 border border-border rounded-lg bg-dark-800/50 animate-fade-in">
          <div>
            <div className="text-xs text-muted uppercase tracking-wide mb-1">Benchmark</div>
            <div className="p-3 border border-border rounded font-mono text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">Pattern:</span>{' '}
                <span className="text-white">{result.patternDesc}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Generation Rate:</span>{' '}
                <span className="text-solana-green">{formatNumber(result.rate)} keys/sec</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs text-muted uppercase tracking-wide mb-1">Difficulty</div>
            <div className="p-3 border border-border rounded font-mono text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">Expected Attempts:</span>{' '}
                <span className="text-white">
                  {formatNumber(Math.round(result.expectedAttempts))}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Estimated Time:</span>{' '}
                <span className="text-solana">{formatDuration(result.expectedSeconds)}</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs text-muted uppercase tracking-wide mb-1">
              Probability of Finding Within
            </div>
            <div className="p-3 border border-border rounded font-mono text-sm space-y-1">
              {result.probabilities.map((p, i) => (
                <div key={i}>
                  <span className="text-white">{p.time}</span>{' '}
                  <span className="text-muted-foreground">→</span>{' '}
                  <span className="text-solana-green">{p.prob}%</span> chance
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted">
            These are statistical estimates. Actual time may vary.
          </p>
        </div>
      )}

      {/* Base58 reference */}
      <div className="p-4 border border-border rounded-lg bg-dark-800/30">
        <h4 className="text-sm font-semibold text-white mb-2">
          Base58 Character Reference
        </h4>
        <p className="text-xs text-muted-foreground mb-2">
          Solana addresses use Base58 encoding (58 characters):
        </p>
        <div className="p-2.5 border border-border rounded font-mono text-xs text-solana tracking-wider break-all">
          123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
        </div>
        <p className="text-xs text-muted mt-2">
          No 0 (zero), O (capital o), I (capital i), or l (lowercase L)
        </p>
      </div>
    </div>
  );
}
