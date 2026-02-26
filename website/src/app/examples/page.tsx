'use client';

import { useState } from 'react';

const examples = [
  {
    id: 'rust-basic',
    lang: 'rust',
    title: 'Rust — Basic Generation',
    code: `use solana_sdk::signer::keypair::Keypair;
use solana_sdk::signer::Signer;

fn main() {
    let keypair = Keypair::new();
    let pubkey = keypair.pubkey();
    println!("Address: {}", pubkey);
    println!("Secret key: {:?}", keypair.to_bytes());
}`,
  },
  {
    id: 'rust-vanity',
    lang: 'rust',
    title: 'Rust — Vanity Address',
    code: `use solana_sdk::signer::keypair::Keypair;
use solana_sdk::signer::Signer;

fn find_vanity(prefix: &str) -> Keypair {
    loop {
        let keypair = Keypair::new();
        let addr = keypair.pubkey().to_string();
        if addr.starts_with(prefix) {
            return keypair;
        }
    }
}

fn main() {
    let kp = find_vanity("Sol");
    println!("Found: {}", kp.pubkey());
}`,
  },
  {
    id: 'rust-multithreaded',
    lang: 'rust',
    title: 'Rust — Multi-threaded Mining',
    code: `use solana_sdk::signer::keypair::Keypair;
use solana_sdk::signer::Signer;
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use std::thread;

fn main() {
    let found = Arc::new(AtomicBool::new(false));
    let threads: Vec<_> = (0..num_cpus::get()).map(|_| {
        let found = found.clone();
        thread::spawn(move || {
            while !found.load(Ordering::Relaxed) {
                let kp = Keypair::new();
                if kp.pubkey().to_string().starts_with("Sol") {
                    found.store(true, Ordering::Relaxed);
                    println!("Found: {}", kp.pubkey());
                    return Some(kp);
                }
            }
            None
        })
    }).collect();

    for t in threads { t.join().ok(); }
}`,
  },
  {
    id: 'ts-basic',
    lang: 'typescript',
    title: 'TypeScript — Basic Generation',
    code: `import { Keypair } from '@solana/web3.js';

const keypair = Keypair.generate();
console.log('Address:', keypair.publicKey.toBase58());
console.log('Secret key:', JSON.stringify(Array.from(keypair.secretKey)));`,
  },
  {
    id: 'ts-vanity',
    lang: 'typescript',
    title: 'TypeScript — Vanity Address',
    code: `import { Keypair } from '@solana/web3.js';

function findVanity(prefix: string): Keypair {
  let attempts = 0;
  while (true) {
    const kp = Keypair.generate();
    attempts++;
    if (kp.publicKey.toBase58().startsWith(prefix)) {
      console.log(\`Found in \${attempts} attempts\`);
      return kp;
    }
  }
}

const wallet = findVanity('So1');
console.log('Address:', wallet.publicKey.toBase58());`,
  },
  {
    id: 'ts-sign',
    lang: 'typescript',
    title: 'TypeScript — Sign & Verify',
    code: `import { Keypair } from '@solana/web3.js';
import * as nacl from 'tweetnacl';

const keypair = Keypair.generate();
const message = new TextEncoder().encode('Hello, Solana!');

// Sign
const signature = nacl.sign.detached(message, keypair.secretKey);
console.log('Signature:', Buffer.from(signature).toString('hex'));

// Verify
const isValid = nacl.sign.detached.verify(
  message, signature, keypair.publicKey.toBytes()
);
console.log('Valid:', isValid); // true`,
  },
  {
    id: 'ts-restore',
    lang: 'typescript',
    title: 'TypeScript — Restore Keypair',
    code: `import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';

// From JSON file (Solana CLI format)
const secretKey = JSON.parse(fs.readFileSync('wallet.json', 'utf-8'));
const keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
console.log('Restored address:', keypair.publicKey.toBase58());`,
  },
  {
    id: 'bash-gen',
    lang: 'bash',
    title: 'Shell — Generate & Verify',
    code: `#!/bin/bash
# Generate a vanity wallet
./scripts/generate-vanity.sh Sol

# Verify the generated keypair
./scripts/verify-keypair.sh ./keys/SolXXX.json

# Batch generate
./scripts/batch-generate.sh --prefix Sol --count 5`,
  },
];

export default function ExamplesPage() {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [copied, setCopied] = useState<string | null>(null);

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'rust', label: 'Rust' },
    { id: 'typescript', label: 'TypeScript' },
    { id: 'bash', label: 'Shell' },
  ];

  const filtered =
    activeFilter === 'all'
      ? examples
      : examples.filter((e) => e.lang === activeFilter);

  function copyCode(id: string, code: string) {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-gradient mb-2">
        Code Examples
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Copy-paste code snippets for integrating Solana wallet generation into your project.
      </p>

      {/* Filter */}
      <div className="flex gap-1 mb-6">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded transition-all ${
              activeFilter === f.id
                ? 'bg-white text-black'
                : 'text-muted-foreground hover:text-white hover:bg-dark-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Examples */}
      <div className="space-y-6">
        {filtered.map((ex) => (
          <div key={ex.id} className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-dark-800 border-b border-border">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded uppercase ${
                  ex.lang === 'rust'
                    ? 'bg-orange-500/20 text-orange-400'
                    : ex.lang === 'typescript'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-green-500/20 text-green-400'
                }`}>
                  {ex.lang}
                </span>
                <span className="text-sm font-medium text-white">{ex.title}</span>
              </div>
              <button
                onClick={() => copyCode(ex.id, ex.code)}
                className="px-2 py-1 text-xs border border-border rounded hover:bg-dark-700 transition-colors text-muted-foreground hover:text-white"
              >
                {copied === ex.id ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <pre className="p-4 overflow-x-auto font-mono text-xs text-muted-foreground leading-relaxed">
              {ex.code}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
