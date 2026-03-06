/**
 * x402 Facilitator Example — Standalone payment verification service
 *
 * This can run as a separate service that verifies and settles x402 payments.
 *
 * Run:
 *   npx ts-node examples/facilitator-example.ts
 */

import express from 'express';
import { X402Facilitator } from '../src/facilitator.js';
import type { PaymentPayload } from '../src/types.js';

const app = express();
app.use(express.json());

const facilitator = new X402Facilitator({
  network: 'solana-devnet',
  waitForConfirmation: true,
});

// ---------------------------------------------------------------------------
// Verify endpoint (no on-chain submission)
// ---------------------------------------------------------------------------

app.post('/verify', async (req, res) => {
  const payment = req.body as PaymentPayload;

  try {
    const result = await facilitator.verify(payment);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      valid: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    });
  }
});

// ---------------------------------------------------------------------------
// Settle endpoint (verify + submit on-chain)
// ---------------------------------------------------------------------------

app.post('/settle', async (req, res) => {
  const payment = req.body as PaymentPayload;

  try {
    const result = await facilitator.settle(payment);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Settlement failed',
    });
  }
});

// ---------------------------------------------------------------------------
// Status endpoint
// ---------------------------------------------------------------------------

app.get('/status/:txSignature', async (req, res) => {
  try {
    const status = await facilitator.getSettlementStatus(
      req.params.txSignature
    );
    res.json(status);
  } catch (error) {
    res.status(500).json({
      confirmed: false,
      error: error instanceof Error ? error.message : 'Status check failed',
    });
  }
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', network: 'solana-devnet' });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 4402;

app.listen(PORT, () => {
  console.log(`x402 Facilitator running on http://localhost:${PORT}`);
  console.log('');
  console.log('Endpoints:');
  console.log(`  POST /verify   — Verify a payment (no on-chain submission)`);
  console.log(`  POST /settle   — Verify + submit payment on-chain`);
  console.log(`  GET  /status/:tx — Check settlement status`);
  console.log(`  GET  /health   — Health check`);
});

