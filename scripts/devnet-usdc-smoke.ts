/**
 * USDC launch-path verification harness for `createV2AndBuyInstructions`.
 *
 * Builds an atomic create_v2 + buy_v2 (USDC quote mint) transaction and either
 * SIMULATES it (default, no broadcast) or broadcasts it once on devnet.
 *
 * This is NOT part of the unit suite — it requires an RPC and a funded keypair.
 *
 * Usage:
 *   # Simulate only (no broadcast). Needs an RPC and a keypair (payer/mint signer).
 *   RPC_URL=<rpc> KEYPAIR=~/.config/solana/id.json npx tsx scripts/devnet-usdc-smoke.ts
 *
 *   # Broadcast once on devnet (free SOL via airdrop). Set the devnet-whitelisted
 *   # quote mint if USDC itself isn't whitelisted on devnet.
 *   RPC_URL=https://api.devnet.solana.com DEVNET_BROADCAST=1 \
 *     DEVNET_QUOTE_MINT=<whitelisted-mint> KEYPAIR=<devnet-funded> \
 *     npx tsx scripts/devnet-usdc-smoke.ts
 */
import { readFileSync } from "node:fs";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";

import { OnlinePumpSdk } from "../src/onlineSdk";
import { USDC_MINT } from "../src/quoteMints";

function loadKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))),
  );
}

async function main(): Promise<void> {
  const rpcUrl = process.env.RPC_URL;
  const keypairPath = process.env.KEYPAIR;
  if (!rpcUrl || !keypairPath) {
    throw new Error("Set RPC_URL and KEYPAIR env vars.");
  }

  const connection = new Connection(rpcUrl, "confirmed");
  const sdk = new OnlinePumpSdk(connection);
  const payer = loadKeypair(keypairPath);
  const mint = Keypair.generate();
  const quoteMint = process.env.DEVNET_QUOTE_MINT
    ? new PublicKey(process.env.DEVNET_QUOTE_MINT)
    : USDC_MINT;

  const global = await sdk.fetchGlobal();
  const ixs = await sdk.createV2AndBuyInstructions({
    global,
    mint: mint.publicKey,
    name: "SMOKE",
    symbol: "SMOKE",
    uri: "https://example.com/smoke.json",
    creator: payer.publicKey,
    user: payer.publicKey,
    amount: new BN("15000000000000"), // 1.5% of supply (token base units)
    solAmount: new BN(0),
    mayhemMode: false,
    quoteMint,
    quoteTokenProgram: TOKEN_PROGRAM_ID,
    quoteAmount: new BN(process.env.QUOTE_AMOUNT ?? "15000000"), // max quote cost (6dp)
  });

  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ...ixs,
    ],
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  tx.sign([payer, mint]);

  const sim = await connection.simulateTransaction(tx, { sigVerify: false });
  console.log("simulate err:", sim.value.err);
  console.log((sim.value.logs ?? []).join("\n"));
  if (sim.value.err) {
    throw new Error("simulation failed — do NOT broadcast");
  }

  if (process.env.DEVNET_BROADCAST === "1") {
    const sig = await connection.sendTransaction(tx);
    console.log("devnet broadcast sig:", sig);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
