'use client';

import { useState } from 'react';
import { ResultField } from './GenerateWallet';
import { isValidBase58, bytesToHex } from '@/lib/utils';

export function Base58Converter() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'b58-to-hex' | 'hex-to-b58' | 'bytes-to-b58' | 'b58-to-bytes'>('b58-to-hex');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  function convert() {
    setError('');
    setResult('');

    try {
      const bs58 = require('bs58');

      switch (mode) {
        case 'b58-to-hex': {
          if (!isValidBase58(input)) throw new Error('Invalid Base58 characters');
          const decoded = bs58.decode(input);
          setResult(bytesToHex(decoded));
          break;
        }
        case 'hex-to-b58': {
          const hex = input.replace(/^0x/, '').replace(/\s/g, '');
          if (!/^[0-9a-fA-F]*$/.test(hex)) throw new Error('Invalid hex characters');
          const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map((b: string) => parseInt(b, 16)));
          setResult(bs58.encode(bytes));
          break;
        }
        case 'bytes-to-b58': {
          const arr = JSON.parse(input);
          if (!Array.isArray(arr)) throw new Error('Input must be a JSON array');
          const bytes = new Uint8Array(arr);
          setResult(bs58.encode(bytes));
          break;
        }
        case 'b58-to-bytes': {
          if (!isValidBase58(input)) throw new Error('Invalid Base58 characters');
          const decoded = bs58.decode(input);
          setResult(JSON.stringify(Array.from(decoded)));
          break;
        }
      }
    } catch (e: any) {
      setError(e.message || 'Conversion failed');
    }
  }

  const modeLabels: Record<string, string> = {
    'b58-to-hex': 'Base58 → Hex',
    'hex-to-b58': 'Hex → Base58',
    'bytes-to-b58': 'Byte Array → Base58',
    'b58-to-bytes': 'Base58 → Byte Array',
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">
          Base58 / Hex / Bytes Converter
        </h3>
        <p className="text-sm text-muted-foreground">
          Convert between Base58, hexadecimal, and byte array formats used in Solana.
        </p>
      </div>

      <div>
        <label className="block text-xs text-muted uppercase tracking-wide mb-1.5">
          Conversion Mode
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(modeLabels) as Array<keyof typeof modeLabels>).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m as any); setResult(''); setError(''); }}
              className={`px-3 py-2 text-xs font-medium rounded border transition-all ${
                mode === m
                  ? 'bg-white text-black border-white'
                  : 'border-border text-muted-foreground hover:text-white hover:border-dark-600'
              }`}
            >
              {modeLabels[m]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted uppercase tracking-wide mb-1.5">
          Input
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            mode === 'b58-to-hex' || mode === 'b58-to-bytes'
              ? 'Base58 string...'
              : mode === 'hex-to-b58'
              ? 'Hex string (e.g., 0a1b2c3d)...'
              : '[174,47,154,16,...]'
          }
          rows={3}
          className="w-full px-3 py-2 bg-dark-800 border border-border rounded font-mono text-xs text-white placeholder:text-muted resize-y"
        />
      </div>

      <button
        onClick={convert}
        className="px-5 py-2.5 bg-white text-black font-semibold text-sm rounded hover:bg-white/90 transition-all active:scale-[0.98]"
      >
        Convert
      </button>

      {error && <p className="text-sm text-red-400">Error: {error}</p>}
      {result && (
        <div className="animate-fade-in">
          <ResultField label={`Output (${modeLabels[mode].split(' → ')[1]})`} value={result} />
        </div>
      )}
    </div>
  );
}
