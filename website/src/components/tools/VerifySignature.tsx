'use client';

import { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';

export function VerifySignature() {
  const [message, setMessage] = useState('');
  const [signature, setSignature] = useState('');
  const [address, setAddress] = useState('');
  const [result, setResult] = useState<'valid' | 'invalid' | null>(null);
  const [error, setError] = useState('');

  function verify() {
    setError('');
    setResult(null);
    try {
      const publicKey = new PublicKey(address);
      const messageBytes = new TextEncoder().encode(message);

      // Parse signature — try hex first, then base64
      let signatureBytes: Uint8Array;
      if (/^[0-9a-fA-F]+$/.test(signature.replace('0x', ''))) {
        const hex = signature.replace('0x', '');
        const bytes = [];
        for (let i = 0; i < hex.length; i += 2) {
          bytes.push(parseInt(hex.substr(i, 2), 16));
        }
        signatureBytes = new Uint8Array(bytes);
      } else {
        signatureBytes = new Uint8Array(Buffer.from(signature, 'base64'));
      }

      if (signatureBytes.length !== 64) {
        throw new Error(`Signature must be 64 bytes, got ${signatureBytes.length}`);
      }

      const isValid = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKey.toBytes()
      );

      setResult(isValid ? 'valid' : 'invalid');
    } catch (e: any) {
      setError(e.message || 'Invalid input');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">
          Verify Signature
        </h3>
        <p className="text-sm text-muted-foreground">
          Verify an Ed25519 signature against a public key.
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
            placeholder="Original message"
            rows={3}
            className="w-full px-3 py-2 bg-dark-800 border border-border rounded font-mono text-sm text-white placeholder:text-muted resize-y"
          />
        </div>
        <div>
          <label className="block text-xs text-muted uppercase tracking-wide mb-1.5">
            Signature (Hex or Base64)
          </label>
          <input
            type="text"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Signature..."
            className="w-full px-3 py-2 bg-dark-800 border border-border rounded font-mono text-sm text-white placeholder:text-muted"
          />
        </div>
        <div>
          <label className="block text-xs text-muted uppercase tracking-wide mb-1.5">
            Public Key (Address)
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Address (Base58)..."
            className="w-full px-3 py-2 bg-dark-800 border border-border rounded font-mono text-sm text-white placeholder:text-muted"
          />
        </div>
      </div>

      <button
        onClick={verify}
        className="px-5 py-2.5 bg-white text-black font-semibold text-sm rounded hover:bg-white/90 transition-all active:scale-[0.98]"
      >
        Verify Signature
      </button>

      {error && <p className="text-sm text-red-400">Error: {error}</p>}
      {result === 'valid' && (
        <div className="p-4 border border-solana-green/30 rounded-lg bg-solana-green/5 animate-fade-in">
          <p className="text-lg font-semibold text-solana-green">✅ SIGNATURE VALID</p>
          <p className="text-sm text-muted-foreground mt-1">
            The message was signed by {address}
          </p>
        </div>
      )}
      {result === 'invalid' && (
        <div className="p-4 border border-red-500/30 rounded-lg bg-red-500/5 animate-fade-in">
          <p className="text-lg font-semibold text-red-400">❌ SIGNATURE INVALID</p>
          <p className="text-sm text-muted-foreground mt-1">
            The signature does not match the message and address.
          </p>
        </div>
      )}
    </div>
  );
}
