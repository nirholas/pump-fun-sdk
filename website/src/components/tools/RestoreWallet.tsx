'use client';

import { useState } from 'react';
import { Keypair } from '@solana/web3.js';
import { ResultField } from './GenerateWallet';

export function RestoreWallet() {
  const [jsonInput, setJsonInput] = useState('');
  const [base58Input, setBase58Input] = useState('');
  const [jsonResult, setJsonResult] = useState<{ address: string } | null>(null);
  const [jsonError, setJsonError] = useState('');
  const [base58Result, setBase58Result] = useState<{
    address: string;
    secretKey: string;
  } | null>(null);
  const [base58Error, setBase58Error] = useState('');

  function restoreFromJson() {
    setJsonError('');
    setJsonResult(null);
    try {
      const arr = JSON.parse(jsonInput);
      if (!Array.isArray(arr)) throw new Error('Input must be a JSON array');
      if (arr.length !== 64)
        throw new Error(`Expected 64 bytes, got ${arr.length}`);
      const secretKey = new Uint8Array(arr);
      const keypair = Keypair.fromSecretKey(secretKey);
      setJsonResult({ address: keypair.publicKey.toBase58() });
    } catch (e: any) {
      setJsonError(e.message || 'Invalid input');
    }
  }

  function restoreFromBase58() {
    setBase58Error('');
    setBase58Result(null);
    try {
      // Use dynamic import approach — bs58 decode via buffer
      const bs58 = require('bs58');
      const decoded = bs58.decode(base58Input);
      if (decoded.length !== 64)
        throw new Error(`Expected 64 bytes, got ${decoded.length}`);
      const keypair = Keypair.fromSecretKey(decoded);
      setBase58Result({
        address: keypair.publicKey.toBase58(),
        secretKey: JSON.stringify(Array.from(keypair.secretKey)),
      });
    } catch (e: any) {
      setBase58Error(e.message || 'Invalid Base58 input');
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">
          Restore Wallet
        </h3>
        <p className="text-sm text-muted-foreground">
          Restore a wallet from a secret key (JSON array or Base58 encoded).
        </p>
      </div>

      {/* JSON restore */}
      <div className="p-4 border border-border rounded-lg bg-dark-800/30 space-y-4">
        <h4 className="text-sm font-semibold text-white border-b border-border pb-2">
          From Secret Key (JSON Array)
        </h4>
        <p className="text-xs text-muted-foreground">
          Paste a Solana CLI compatible keypair JSON (64-byte array)
        </p>
        <div>
          <label className="block text-xs text-muted uppercase tracking-wide mb-1.5">
            Secret Key JSON Array
          </label>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder="[174,47,154,16,202,193,206,113,199,190,53,133,...]"
            rows={3}
            className="w-full px-3 py-2 bg-dark-800 border border-border rounded font-mono text-xs text-white placeholder:text-muted resize-y"
          />
        </div>
        <button
          onClick={restoreFromJson}
          className="px-4 py-2 bg-white text-black font-semibold text-sm rounded hover:bg-white/90 transition-all active:scale-[0.98]"
        >
          Restore Wallet
        </button>
        {jsonError && <p className="text-sm text-red-400">Error: {jsonError}</p>}
        {jsonResult && (
          <div className="animate-fade-in">
            <ResultField label="Public Key (Address)" value={jsonResult.address} />
            <p className="text-sm text-solana-green mt-2">✅ Keypair restored successfully</p>
          </div>
        )}
      </div>

      {/* Base58 restore */}
      <div className="p-4 border border-border rounded-lg bg-dark-800/30 space-y-4">
        <h4 className="text-sm font-semibold text-white border-b border-border pb-2">
          From Base58 Secret Key
        </h4>
        <p className="text-xs text-muted-foreground">
          Enter a Base58-encoded secret key (as exported by some wallets)
        </p>
        <div>
          <label className="block text-xs text-muted uppercase tracking-wide mb-1.5">
            Base58 Secret Key
          </label>
          <input
            type="text"
            value={base58Input}
            onChange={(e) => setBase58Input(e.target.value)}
            placeholder="Base58 encoded secret key..."
            className="w-full px-3 py-2 bg-dark-800 border border-border rounded font-mono text-sm text-white placeholder:text-muted"
          />
        </div>
        <button
          onClick={restoreFromBase58}
          className="px-4 py-2 bg-white text-black font-semibold text-sm rounded hover:bg-white/90 transition-all active:scale-[0.98]"
        >
          Restore Wallet
        </button>
        {base58Error && <p className="text-sm text-red-400">Error: {base58Error}</p>}
        {base58Result && (
          <div className="space-y-3 animate-fade-in">
            <ResultField label="Public Key (Address)" value={base58Result.address} />
            <ResultField label="Secret Key (JSON Array)" value={base58Result.secretKey} />
            <p className="text-sm text-solana-green">✅ Keypair restored successfully</p>
          </div>
        )}
      </div>
    </div>
  );
}
