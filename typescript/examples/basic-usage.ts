/**
 * @fileoverview Basic usage example for the Solana vanity address generator.
 *
 * This example demonstrates the simplest way to generate a vanity address
 * using the TypeScript library.
 *
 * Run with: npx ts-node examples/basic-usage.ts
 */

import { VanityGenerator, saveKeypair } from '../src/lib';

async function main(): Promise<void> {
  console.log('🔑 Solana Vanity Address Generator - Basic Example\n');

  // Configure the prefix you want
  const prefix = 'So';

  console.log(`Searching for address starting with "${prefix}"...\n`);

  // Create the generator
  const generator = new VanityGenerator({
    prefix,
    // Optional: report progress every 1000 attempts
    onProgress: (attempts, rate) => {
      process.stdout.write(`\rAttempts: ${attempts.toLocaleString()} | Rate: ${rate.toFixed(0)}/sec`);
    },
  });

  // Show difficulty estimate
  const estimated = generator.getEstimatedAttempts();
  console.log(`Expected attempts: ~${estimated.toLocaleString()}`);
  console.log(`Estimated time: ${generator.getTimeEstimate(15000)}\n`);

  // Generate the address
  const result = await generator.generate();

  // Clear the progress line
  process.stdout.write('\r' + ' '.repeat(60) + '\r');

  console.log('\n✅ Found matching address!\n');
  console.log(`  Address:  ${result.publicKey}`);
  console.log(`  Attempts: ${result.attempts.toLocaleString()}`);
  console.log(`  Duration: ${(result.duration / 1000).toFixed(2)}s\n`);

  // Save to file
  const outputPath = `${result.publicKey}.json`;
  await saveKeypair(result.secretKey, outputPath);

  console.log(`📁 Keypair saved to: ${outputPath}\n`);

  console.log('⚠️  IMPORTANT: Keep this file secure!');
  console.log('   It contains your private key.\n');

  console.log('Usage examples:');
  console.log(`  solana config set --keypair ${outputPath}`);
  console.log(`  solana balance ${result.publicKey}`);
}

main().catch(console.error);
