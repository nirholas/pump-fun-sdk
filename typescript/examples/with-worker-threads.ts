/**
 * @fileoverview Example demonstrating worker threads for parallel generation.
 *
 * EDUCATIONAL NOTE: This example shows how to use Node.js worker threads
 * to parallelize vanity address generation. While JavaScript is single-threaded,
 * worker threads allow true parallel execution.
 *
 * For production use, consider the Rust CLI implementation which is significantly
 * faster due to native performance.
 *
 * Run with: npx ts-node examples/with-worker-threads.ts
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { cpus } from 'os';
import * as path from 'path';
import { VanityGenerator, saveKeypair } from '../src/lib';
import type { GenerationResult, VanityOptions } from '../src/lib/types';

/**
 * Configuration for the vanity address search
 */
interface WorkerConfig {
  options: VanityOptions;
  workerId: number;
}

/**
 * Message from worker to main thread
 */
interface WorkerMessage {
  type: 'result' | 'progress';
  workerId: number;
  result?: GenerationResult;
  attempts?: number;
  rate?: number;
}

/**
 * Worker thread code
 */
async function runWorker(): Promise<void> {
  const config = workerData as WorkerConfig;
  const { options, workerId } = config;

  const generator = new VanityGenerator({
    ...options,
    onProgress: (attempts, rate) => {
      const message: WorkerMessage = {
        type: 'progress',
        workerId,
        attempts,
        rate,
      };
      parentPort?.postMessage(message);
    },
  });

  try {
    const result = await generator.generate();
    const message: WorkerMessage = {
      type: 'result',
      workerId,
      result,
    };
    parentPort?.postMessage(message);
  } catch (error) {
    // Max attempts reached or other error
    parentPort?.postMessage({
      type: 'progress',
      workerId,
      attempts: -1,
    });
  }
}

/**
 * Main thread code
 */
async function main(): Promise<void> {
  console.log('🔑 Solana Vanity Address Generator - Worker Threads Example\n');

  const numWorkers = cpus().length;
  console.log(`Using ${numWorkers} worker threads\n`);

  const prefix = 'So';
  const options: VanityOptions = {
    prefix,
    maxAttempts: 10000000, // Max per worker
  };

  console.log(`Searching for address starting with "${prefix}"...\n`);

  // Track progress from each worker
  const workerProgress = new Map<number, { attempts: number; rate: number }>();
  const workers: Worker[] = [];
  let foundResult: GenerationResult | null = null;

  // Create workers
  for (let i = 0; i < numWorkers; i++) {
    const config: WorkerConfig = {
      options,
      workerId: i,
    };

    const worker = new Worker(__filename, {
      workerData: config,
    });

    worker.on('message', (message: WorkerMessage) => {
      if (message.type === 'result' && foundResult === null) {
        foundResult = message.result ?? null;

        // Terminate all workers
        for (const w of workers) {
          w.terminate().catch(() => {
            // Ignore termination errors
          });
        }
      } else if (message.type === 'progress') {
        if (message.attempts !== undefined && message.rate !== undefined) {
          workerProgress.set(message.workerId, {
            attempts: message.attempts,
            rate: message.rate,
          });
        }

        // Display combined progress
        let totalAttempts = 0;
        let totalRate = 0;

        for (const progress of workerProgress.values()) {
          totalAttempts += progress.attempts;
          totalRate += progress.rate;
        }

        process.stdout.write(
          `\rTotal: ${totalAttempts.toLocaleString()} attempts | ${totalRate.toFixed(0)}/sec (${numWorkers} workers)`
        );
      }
    });

    worker.on('error', (error) => {
      console.error(`Worker ${i} error:`, error);
    });

    workers.push(worker);
  }

  // Wait for result
  await new Promise<void>((resolve) => {
    const checkInterval = setInterval(() => {
      if (foundResult !== null) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);
  });

  // Clear progress line
  process.stdout.write('\r' + ' '.repeat(80) + '\r');

  // Type assertion needed because TypeScript can't track the async callback modification
  const result = foundResult as GenerationResult | null;

  if (result !== null) {
    console.log('\n✅ Found matching address!\n');
    console.log(`  Address:  ${result.publicKey}`);
    console.log(`  Attempts: ${result.attempts.toLocaleString()}`);
    console.log(`  Duration: ${(result.duration / 1000).toFixed(2)}s\n`);

    // Save to file
    const outputPath = `${result.publicKey}.json`;
    await saveKeypair(result.secretKey, outputPath);
    console.log(`📁 Keypair saved to: ${outputPath}\n`);
  } else {
    console.log('❌ No match found within the attempt limit.\n');
  }

  // Cleanup
  for (const worker of workers) {
    worker.terminate().catch(() => {
      // Ignore
    });
  }
}

// Entry point
if (isMainThread) {
  main().catch(console.error);
} else {
  runWorker().catch((error) => {
    console.error('Worker error:', error);
  });
}
