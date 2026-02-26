'use client';

import { useState } from 'react';
import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { ResultField } from './GenerateWallet';
import { bytesToHex } from '@/lib/utils';

export function SignMessage() {
  const [message, setMessage] = useState('');
  const [keyJson, setKeyJson] = useState('');
  const [result, setResult] = useState<{
    signer: string;
    signatureHex: string;
    signatureBase64: string;
  } | null>(null);
  const [error, setError] = useState('');

  function sign() {
    setError('');
    setResult(null);
    try {
      const secretKeyArray = JSON.parse(keyJson);
      const secretKey = new Uint8Array(secretKeyArray);
      const keypair = Keypair.fromSecretKey(secretKey);

      const messageBytes = new TextEncoder().encode(message);
      const signature = nacl.sign.detached(messageBytes, keypair.secretKey);

      setResult({
        signer: keypair.publicKey.toBase58(),
        signatureHex: bytesToHex(signature),
        signatureBase64: Buffer.from(signature).toString('base64'),
      });
    } catch (e: any) {
      setError(e.message || 'Invalid input');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Sign Message</h3>
        <p className="text-sm text-muted-foreground">
          Sign a message using Ed25519 (via tweetnacl). Prove ownership of an
          address.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs text-muted uppercase tracking-wide mb-1.5">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter message to sign"
            rows={3}
            className="w-full px-3 py-2 bg-dark-800 border border-border rounded font-mono text-sm text-white placeholder:text-muted resize-y"
          />
        </div>
        <div>
          <label className="block text-xs text-muted uppercase tracking-wide mb-1.5">
            Secret Key (JSON Array)
          </label>
          <textarea
            value={keyJson}
            onChange={(e) => setKeyJson(e.target.value)}
            placeholder="[174,47,154,16,202,193,206,113,199,190,53,133,...]"
            rows={3}
            className="w-full px-3 py-2 bg-dark-800 border border-border rounded font-mono text-xs text-white placeholder:text-muted resize-y"
          />
        </div>
      </div>

      <button
        onClick={sign}
        className="px-5 py-2.5 bg-white text-black font-semibold text-sm rounded hover:bg-white/90 transition-all active:scale-[0.98]"
      >
        Sign Message
      </button>

      {error && <p className="text-sm text-red-400">Error: {error}</p>}
      {result && (
        <div className="space-y-4 p-4 border border-border rounded-lg bg-dark-800/50 animate-fade-in">
          <ResultField label="Signer Address" value={result.signer} />
          <ResultField label="Signature (Hex)" value={result.signatureHex} />
          <ResultField label="Signature (Base64)" value={result.signatureBase64} />
        </div>
      )}
    </div>
  );
}
