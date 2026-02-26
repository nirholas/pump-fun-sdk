'use client';

import { useState } from 'react';
import { PublicKey, Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { bytesToHex } from '@/lib/utils';
import { ResultField } from './GenerateWallet';

export function ValidateAddress() {
  const [address, setAddress] = useState('');
  const [result, setResult] = useState<{
    valid: boolean;
    hex?: string;
    length?: number;
    byteLength?: number;
    error?: string;
  } | null>(null);

  function validate() {
    try {
      const publicKey = new PublicKey(address);
      const bytes = publicKey.toBytes();
      setResult({
        valid: true,
        hex: bytesToHex(bytes),
        length: address.length,
        byteLength: bytes.length,
      });
    } catch (e: any) {
      setResult({ valid: false, error: e.message });
    }
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-white border-b border-border pb-2">
        Validate Address
      </h4>
      <p className="text-xs text-muted-foreground">
        Check if a Solana address is valid Base58
      </p>
      <div>
        <label className="block text-xs text-muted uppercase tracking-wide mb-1.5">
          Solana Address
        </label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Address (Base58)..."
          className="w-full px-3 py-2 bg-dark-800 border border-border rounded font-mono text-sm text-white placeholder:text-muted"
        />
      </div>
      <button
        onClick={validate}
        className="px-4 py-2 bg-white text-black font-semibold text-sm rounded hover:bg-white/90 transition-all active:scale-[0.98]"
      >
        Validate
      </button>
      {result && result.valid && (
        <div className="space-y-3 p-4 border border-solana-green/30 rounded-lg bg-solana-green/5 animate-fade-in">
          <p className="text-lg font-semibold text-solana-green">✅ VALID SOLANA ADDRESS</p>
          <ResultField label="Address" value={address} />
          <ResultField label="Bytes (Hex)" value={result.hex!} />
          <p className="text-xs text-muted-foreground">
            {result.length} characters ({result.byteLength} bytes)
          </p>
        </div>
      )}
      {result && !result.valid && (
        <div className="p-4 border border-red-500/30 rounded-lg bg-red-500/5 animate-fade-in">
          <p className="text-lg font-semibold text-red-400">❌ INVALID ADDRESS</p>
          <p className="text-sm text-muted-foreground mt-1">{result.error}</p>
        </div>
      )}
    </div>
  );
}

export function ValidateKeypair() {
  const [jsonInput, setJsonInput] = useState('');
  const [checks, setChecks] = useState<
    Array<{ name: string; passed: boolean; message: string }>
  >([]);
  const [publicKey, setPublicKey] = useState('');

  function validate() {
    const results: Array<{ name: string; passed: boolean; message: string }> = [];
    setPublicKey('');

    try {
      // Check 1: Valid JSON
      let arr: any;
      try {
        arr = JSON.parse(jsonInput);
        results.push({ name: 'Valid JSON', passed: true, message: 'Input is valid JSON' });
      } catch {
        results.push({ name: 'Valid JSON', passed: false, message: 'Input is not valid JSON' });
        setChecks(results);
        return;
      }

      // Check 2: Is array
      if (Array.isArray(arr)) {
        results.push({ name: 'Is Array', passed: true, message: 'Input is an array' });
      } else {
        results.push({ name: 'Is Array', passed: false, message: 'Input must be an array' });
        setChecks(results);
        return;
      }

      // Check 3: Correct length
      if (arr.length === 64) {
        results.push({ name: 'Correct Length', passed: true, message: '64 bytes (correct)' });
      } else {
        results.push({
          name: 'Correct Length',
          passed: false,
          message: `${arr.length} bytes (expected 64)`,
        });
        setChecks(results);
        return;
      }

      // Check 4: Valid bytes
      const allBytes = arr.every(
        (v: any) => Number.isInteger(v) && v >= 0 && v <= 255
      );
      results.push({
        name: 'Valid Bytes',
        passed: allBytes,
        message: allBytes ? 'All values are 0-255' : 'Some values are not valid bytes',
      });
      if (!allBytes) {
        setChecks(results);
        return;
      }

      // Check 5: Can construct Keypair
      const secretKey = new Uint8Array(arr);
      let keypair: Keypair;
      try {
        keypair = Keypair.fromSecretKey(secretKey);
        results.push({
          name: 'Keypair Construction',
          passed: true,
          message: 'Successfully created Keypair',
        });
      } catch (e: any) {
        results.push({ name: 'Keypair Construction', passed: false, message: e.message });
        setChecks(results);
        return;
      }

      // Check 6: Public key derivation
      const derived = keypair.publicKey.toBase58();
      const storedPubkeyBytes = secretKey.slice(32);
      const storedPubkey = new PublicKey(storedPubkeyBytes).toBase58();
      results.push({
        name: 'Public Key Derivation',
        passed: derived === storedPubkey,
        message:
          derived === storedPubkey
            ? 'Stored public key matches derived'
            : 'Public key mismatch',
      });

      // Check 7: Sign and verify test
      try {
        const testMsg = new TextEncoder().encode('test message');
        const sig = nacl.sign.detached(testMsg, keypair.secretKey);
        const verified = nacl.sign.detached.verify(
          testMsg,
          sig,
          keypair.publicKey.toBytes()
        );
        results.push({
          name: 'Sign/Verify Test',
          passed: verified,
          message: verified
            ? 'Can sign and verify messages'
            : 'Signature verification failed',
        });
      } catch (e: any) {
        results.push({ name: 'Sign/Verify Test', passed: false, message: e.message });
      }

      setPublicKey(derived);
    } catch (e: any) {
      results.push({ name: 'Unknown Error', passed: false, message: e.message });
    }

    setChecks(results);
  }

  const allPassed = checks.length > 0 && checks.every((c) => c.passed);

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-white border-b border-border pb-2">
        Validate Keypair JSON
      </h4>
      <p className="text-xs text-muted-foreground">
        Full 7-point validation of a keypair JSON file
      </p>
      <div>
        <label className="block text-xs text-muted uppercase tracking-wide mb-1.5">
          Keypair JSON Array
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
        onClick={validate}
        className="px-4 py-2 bg-white text-black font-semibold text-sm rounded hover:bg-white/90 transition-all active:scale-[0.98]"
      >
        Validate Keypair
      </button>

      {checks.length > 0 && (
        <div
          className={`p-4 border rounded-lg animate-fade-in ${
            allPassed
              ? 'border-solana-green/30 bg-solana-green/5'
              : 'border-red-500/30 bg-red-500/5'
          }`}
        >
          <p
            className={`text-lg font-semibold mb-3 ${
              allPassed ? 'text-solana-green' : 'text-red-400'
            }`}
          >
            {allPassed ? '✅ KEYPAIR VALID' : '❌ KEYPAIR INVALID'}
          </p>
          <div className="space-y-1">
            {checks.map((c, i) => (
              <div key={i} className="text-sm">
                <span className={c.passed ? 'text-solana-green' : 'text-red-400'}>
                  {c.passed ? '✅' : '❌'}
                </span>{' '}
                <span className="font-medium text-white">{c.name}</span>:{' '}
                <span className="text-muted-foreground">{c.message}</span>
              </div>
            ))}
          </div>
          {allPassed && publicKey && (
            <div className="mt-4">
              <ResultField label="Public Key" value={publicKey} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function VerifyKeyAddressPair() {
  const [keyJson, setKeyJson] = useState('');
  const [expectedAddress, setExpectedAddress] = useState('');
  const [result, setResult] = useState<{
    match: boolean;
    derived?: string;
  } | null>(null);
  const [error, setError] = useState('');

  function verify() {
    setError('');
    setResult(null);
    try {
      const arr = JSON.parse(keyJson);
      const secretKey = new Uint8Array(arr);
      const keypair = Keypair.fromSecretKey(secretKey);
      const derived = keypair.publicKey.toBase58();
      setResult({ match: derived === expectedAddress, derived });
    } catch (e: any) {
      setError(e.message || 'Invalid input');
    }
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-white border-b border-border pb-2">
        Verify Key-Address Pair
      </h4>
      <p className="text-xs text-muted-foreground">
        Verify that a secret key derives to the expected address
      </p>
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
      <div>
        <label className="block text-xs text-muted uppercase tracking-wide mb-1.5">
          Expected Address
        </label>
        <input
          type="text"
          value={expectedAddress}
          onChange={(e) => setExpectedAddress(e.target.value)}
          placeholder="Address (Base58)..."
          className="w-full px-3 py-2 bg-dark-800 border border-border rounded font-mono text-sm text-white placeholder:text-muted"
        />
      </div>
      <button
        onClick={verify}
        className="px-4 py-2 bg-white text-black font-semibold text-sm rounded hover:bg-white/90 transition-all active:scale-[0.98]"
      >
        Verify Match
      </button>

      {error && <p className="text-sm text-red-400">Error: {error}</p>}
      {result && result.match && (
        <div className="p-4 border border-solana-green/30 rounded-lg bg-solana-green/5 animate-fade-in">
          <p className="text-lg font-semibold text-solana-green">✅ MATCH</p>
          <p className="text-sm text-muted-foreground mt-1">
            The secret key correctly derives to the expected address.
          </p>
          <div className="mt-3">
            <ResultField label="Derived Address" value={result.derived!} />
          </div>
        </div>
      )}
      {result && !result.match && (
        <div className="p-4 border border-red-500/30 rounded-lg bg-red-500/5 animate-fade-in space-y-3">
          <p className="text-lg font-semibold text-red-400">❌ MISMATCH</p>
          <ResultField label="Expected" value={expectedAddress} />
          <ResultField label="Derived" value={result.derived!} />
        </div>
      )}
    </div>
  );
}
