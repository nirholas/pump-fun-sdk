/**
 * x402 Payment Utilities for Solana
 *
 * Creates and encodes USDC transfer transactions for x402 payments.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TokenAccountNotFoundError,
} from '@solana/spl-token';
import bs58 from 'bs58';

import type {
  PaymentAccept,
  PaymentPayload,
  SolanaNetwork,
} from './types.js';
import { X402_VERSION } from './types.js';
import { getUsdcMint, getDefaultRpcUrl } from './constants.js';

// ---------------------------------------------------------------------------
// Create a payment transaction
// ---------------------------------------------------------------------------

export interface CreatePaymentOptions {
  /** The payment-required details from the server */
  accept: PaymentAccept;

  /** Payer's keypair */
  signer: {
    publicKey: { toBase58(): string; toBytes(): Uint8Array };
    secretKey: Uint8Array;
  };

  /** Solana RPC connection */
  connection: Connection;

  /** Optional server-provided nonce */
  nonce?: string;
}

/**
 * Build, sign, and serialise a USDC transfer transaction for an x402 payment.
 *
 * The transaction is **fully signed** by the payer but NOT submitted to the
 * network — the facilitator or server does that after verification.
 */
export async function createPaymentTransaction(
  opts: CreatePaymentOptions
): Promise<PaymentPayload> {
  const { accept, signer, connection, nonce } = opts;

  const payerPubkey = new PublicKey(signer.publicKey.toBase58());
  const recipientPubkey = new PublicKey(accept.payTo);
  const mintPubkey = new PublicKey(accept.token);
  const amount = BigInt(accept.maxAmountRequired);

  // Derive associated token accounts
  const payerAta = await getAssociatedTokenAddress(mintPubkey, payerPubkey);
  const recipientAta = await getAssociatedTokenAddress(
    mintPubkey,
    recipientPubkey
  );

  const instructions: TransactionInstruction[] = [];

  // Check if recipient ATA exists — create it if not
  try {
    await getAccount(connection, recipientAta);
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          payerPubkey,
          recipientAta,
          recipientPubkey,
          mintPubkey
        )
      );
    } else {
      throw error;
    }
  }

  // SPL token transfer
  instructions.push(
    createTransferInstruction(
      payerAta,
      recipientAta,
      payerPubkey,
      amount
    )
  );

  // Add a memo instruction for traceability (optional but useful)
  const memoData = JSON.stringify({
    protocol: 'x402',
    version: X402_VERSION,
    resource: accept.resource,
    ...(nonce ? { nonce } : {}),
  });
  instructions.push(
    new TransactionInstruction({
      keys: [{ pubkey: payerPubkey, isSigner: true, isWritable: false }],
      programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
      data: Buffer.from(memoData),
    })
  );

  // Build the transaction
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('confirmed');

  const transaction = new Transaction();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = payerPubkey;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.add(...instructions);

  // Sign with payer's keypair
  const keypair = Keypair.fromSecretKey(signer.secretKey);
  transaction.sign(keypair);

  // Serialise (base64)
  const serialised = transaction
    .serialize({ requireAllSignatures: true })
    .toString('base64');

  return {
    x402Version: X402_VERSION,
    scheme: accept.scheme,
    network: accept.network,
    transaction: serialised,
    amount: accept.maxAmountRequired,
    token: accept.token,
    payer: payerPubkey.toBase58(),
    payTo: accept.payTo,
    resource: accept.resource,
    ...(nonce ? { nonce } : {}),
  };
}

// ---------------------------------------------------------------------------
// Encode / decode payment payloads for HTTP headers
// ---------------------------------------------------------------------------

/** Encode a PaymentPayload to a Base64 string for the X-PAYMENT header */
export function encodePayment(payload: PaymentPayload): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json).toString('base64');
}

/** Decode a Base64-encoded X-PAYMENT header back into a PaymentPayload */
export function decodePayment(encoded: string): PaymentPayload {
  const json = Buffer.from(encoded, 'base64').toString('utf-8');
  return JSON.parse(json) as PaymentPayload;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a human-readable USDC amount (e.g. "1.50") to base units ("1500000").
 */
export function usdcToBaseUnits(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return Math.round(num * 1_000_000).toString();
}

/**
 * Convert base units (e.g. "1500000") to a human-readable USDC string ("1.50").
 */
export function baseUnitsToUsdc(baseUnits: string | bigint): string {
  const n =
    typeof baseUnits === 'string' ? BigInt(baseUnits) : baseUnits;
  const whole = n / 1_000_000n;
  const frac = n % 1_000_000n;
  const fracStr = frac.toString().padStart(6, '0').replace(/0+$/, '') || '0';
  return `${whole}.${fracStr}`;
}

/**
 * Generate a random nonce string for replay protection.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bs58.encode(bytes);
}
