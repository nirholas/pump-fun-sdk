/**
 * @fileoverview Example demonstrating batch generation of multiple vanity addresses.
 *
 * This example shows how to generate multiple vanity addresses with the same
 * pattern, useful for creating a set of related addresses.
 *
 * Run with: npx ts-node examples/batch-generation.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  generateMultipleVanityAddresses,
  saveKeypair,
  clearSensitiveData,
} from '../src/lib';
import type { GenerationResult } from '../src/lib/types';

/**
 * Summary of batch generation
 */
interface BatchSummary {
  totalAddresses: number;
  totalAttempts: number;
  totalDuration: number;
  averageAttempts: number;
  averageDuration: number;
  addresses: string[];
}

async function main(): Promise<void> {
  console.log('🔑 Solana Vanity Address Generator - Batch Generation Example\n');

  // Configuration
  const prefix = 'A';
  const count = 3;
  const outputDir = './batch-keypairs';

  console.log(`Generating ${count} addresses starting with "${prefix}"...\n`);

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Track results
  const results: GenerationResult[] = [];

  // Generate addresses
  const allResults = await generateMultipleVanityAddresses(
    {
      prefix,
      onProgress: (attempts, rate) => {
        process.stdout.write(`\rSearching: ${attempts.toLocaleString()} attempts | ${rate.toFixed(0)}/sec`);
      },
    },
    count,
    (result, index) => {
      // Clear progress line
      process.stdout.write('\r' + ' '.repeat(60) + '\r');
      console.log(`✅ Found address ${index + 1}/${count}: ${result.publicKey}`);
      results.push(result);
    }
  );

  console.log('\n');

  // Save all keypairs
  console.log('Saving keypairs...\n');

  for (let i = 0; i < allResults.length; i++) {
    const result = allResults[i];
    if (result === undefined) {
      continue;
    }

    const outputPath = path.join(outputDir, `${result.publicKey}.json`);
    await saveKeypair(result.secretKey, outputPath);
    console.log(`  ${i + 1}. ${result.publicKey}`);
    console.log(`     Saved to: ${outputPath}`);
    console.log(`     Attempts: ${result.attempts.toLocaleString()}, Duration: ${(result.duration / 1000).toFixed(2)}s\n`);

    // Clear sensitive data from memory
    clearSensitiveData(result.secretKey);
  }

  // Calculate summary
  const summary: BatchSummary = {
    totalAddresses: allResults.length,
    totalAttempts: allResults.reduce((sum, r) => sum + r.attempts, 0),
    totalDuration: allResults.reduce((sum, r) => sum + r.duration, 0),
    averageAttempts: allResults.reduce((sum, r) => sum + r.attempts, 0) / allResults.length,
    averageDuration: allResults.reduce((sum, r) => sum + r.duration, 0) / allResults.length,
    addresses: allResults.map((r) => r.publicKey),
  };

  // Display summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                     BATCH SUMMARY                          ');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`  Addresses generated:  ${summary.totalAddresses}`);
  console.log(`  Total attempts:       ${summary.totalAttempts.toLocaleString()}`);
  console.log(`  Total duration:       ${(summary.totalDuration / 1000).toFixed(2)}s`);
  console.log(`  Average attempts:     ${Math.round(summary.averageAttempts).toLocaleString()}`);
  console.log(`  Average duration:     ${(summary.averageDuration / 1000).toFixed(2)}s\n`);

  console.log('  Output directory:', path.resolve(outputDir));
  console.log('\n═══════════════════════════════════════════════════════════\n');

  // Save summary to file
  const summaryPath = path.join(outputDir, 'summary.json');
  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        ...summary,
        generatedAt: new Date().toISOString(),
        prefix,
      },
      null,
      2
    )
  );
  console.log(`📋 Summary saved to: ${summaryPath}\n`);

  console.log('⚠️  IMPORTANT: All keypair files in this directory contain private keys.');
  console.log('   Keep them secure and create backups!\n');
}

main().catch(console.error);
