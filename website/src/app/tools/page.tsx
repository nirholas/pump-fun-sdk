'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { GenerateWallet } from '@/components/tools/GenerateWallet';
import { VanityGenerator } from '@/components/tools/VanityGenerator';
import { RestoreWallet } from '@/components/tools/RestoreWallet';
import { SignMessage } from '@/components/tools/SignMessage';
import { VerifySignature } from '@/components/tools/VerifySignature';
import {
  ValidateAddress,
  ValidateKeypair,
  VerifyKeyAddressPair,
} from '@/components/tools/Validate';
import { DifficultyEstimator } from '@/components/tools/DifficultyEstimator';
import { Base58Converter } from '@/components/tools/Base58Converter';
import { BatchGenerator } from '@/components/tools/BatchGenerator';

const tabs = [
  { id: 'generate', label: 'Generate', icon: '⚡' },
  { id: 'vanity', label: 'Vanity', icon: '🔑' },
  { id: 'batch', label: 'Batch', icon: '📦' },
  { id: 'restore', label: 'Restore', icon: '🔄' },
  { id: 'sign', label: 'Sign', icon: '✍️' },
  { id: 'verify', label: 'Verify', icon: '✅' },
  { id: 'validate', label: 'Validate', icon: '🔍' },
  { id: 'converter', label: 'Converter', icon: '🔀' },
  { id: 'estimate', label: 'Estimate', icon: '📊' },
] as const;

type TabId = (typeof tabs)[number]['id'];

export default function ToolsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('generate');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-gradient mb-2">
          Wallet Tools
        </h1>
        <p className="text-sm text-muted-foreground">
          All tools run entirely in your browser using official @solana/web3.js.
          No server calls.
        </p>
      </motion.div>

      {/* Security banner */}
      <div className="mb-6 p-3 border border-border rounded-lg bg-dark-800/30 text-xs text-muted-foreground">
        <strong className="text-white">⚠ SECURITY:</strong> Disconnect from the
        internet before generating or entering private keys. Never share your
        secret keys. All cryptography uses official Solana Labs libraries only.
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 border-b border-border pb-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-3 py-2 text-xs sm:text-sm font-medium rounded transition-all',
              activeTab === tab.id
                ? 'bg-white text-black'
                : 'text-muted-foreground hover:text-white hover:bg-dark-700'
            )}
          >
            <span className="mr-1.5 hidden sm:inline">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tool panels */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="p-5 sm:p-6 border border-border rounded-lg bg-dark-800/20"
      >
        {activeTab === 'generate' && <GenerateWallet />}
        {activeTab === 'vanity' && <VanityGenerator />}
        {activeTab === 'batch' && <BatchGenerator />}
        {activeTab === 'restore' && <RestoreWallet />}
        {activeTab === 'sign' && <SignMessage />}
        {activeTab === 'verify' && <VerifySignature />}
        {activeTab === 'validate' && (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                Validation Tools
              </h3>
            </div>
            <ValidateAddress />
            <ValidateKeypair />
            <VerifyKeyAddressPair />
          </div>
        )}
        {activeTab === 'estimate' && <DifficultyEstimator />}
        {activeTab === 'converter' && <Base58Converter />}
      </motion.div>

      {/* Quick reference */}
      <div className="mt-8 p-4 border border-border rounded-lg bg-dark-800/20 text-xs text-muted-foreground">
        <p className="font-medium text-white text-sm mb-2">Quick Reference</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <span className="text-muted">Crypto Library:</span>{' '}
            <span className="text-white font-mono">@solana/web3.js</span>
          </div>
          <div>
            <span className="text-muted">Key Type:</span>{' '}
            <span className="text-white font-mono">Ed25519</span>
          </div>
          <div>
            <span className="text-muted">Encoding:</span>{' '}
            <span className="text-white font-mono">Base58</span>
          </div>
          <div>
            <span className="text-muted">Keypair Size:</span>{' '}
            <span className="text-white font-mono">64 bytes</span>
          </div>
          <div>
            <span className="text-muted">Address Size:</span>{' '}
            <span className="text-white font-mono">32 bytes</span>
          </div>
          <div>
            <span className="text-muted">Network Calls:</span>{' '}
            <span className="text-solana-green font-mono">None (offline)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
