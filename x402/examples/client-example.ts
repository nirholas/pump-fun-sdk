/**
 * x402 Client Example — Auto-pay for paywalled APIs
 *
 * Run:
 *   npx ts-node examples/client-example.ts
 *
 * Make sure the server example is running first!
 */

import { Keypair } from '@solana/web3.js';
import { X402Client } from '../src/client.js';
import { baseUnitsToUsdc } from '../src/payment.js';

async function main() {
  // Create a keypair (in production, load your funded keypair)
  const signer = Keypair.generate();

  console.log('=== x402 Client Example ===');
  console.log(`Payer: ${signer.publicKey.toBase58()}`);
  console.log('');

  // Create the x402 client
  const client = new X402Client({
    signer,
    network: 'solana-devnet',
    maxPaymentAmount: '1000000', // Max $1 USDC per request
  });

  // Listen for payment events
  client.on((event) => {
    console.log(`[Payment Event] ${event.type}`);
    console.log(`  Resource: ${event.resource}`);
    console.log(`  Amount: ${baseUnitsToUsdc(event.amount)} USDC`);
    if (event.error) console.log(`  Error: ${event.error}`);
    console.log('');
  });

  // Make a request to a paywalled endpoint
  console.log('Fetching /premium...');
  try {
    const response = await client.fetch('http://localhost:3402/premium');
    console.log(`Status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log('Data:', JSON.stringify(data, null, 2));
    } else {
      console.log('Response:', await response.text());
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error);

