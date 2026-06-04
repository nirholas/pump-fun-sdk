/**
 * USDC launch-path verification harness for `createV2AndBuyInstructions`.
 *
 * Builds an atomic create_v2 + buy_v2 (USDC quote mint) transaction and either
 * SIMULATES it (default, no broadcast) or broadcasts it once on devnet.
 *
 * The USDC create_v2 + buy_v2 set serializes to ~1361 bytes across 32 unique
 * accounts, which exceeds the 1232-byte single-transaction limit. It therefore
 * MUST be sent as a v0 transaction with an Address Lookup Table (ALT). This
 * harness builds an ephemeral ALT over the static (non-signer) accounts, waits
 * for it to activate, then compiles the create+buy into a v0 message that
 * references it. (The SOL path fits without an ALT.)
 *
 * This is NOT part of the unit suite — it requires an RPC and a funded keypair.
 *
 * Usage:
 *   # Simulate only (no broadcast). Needs an RPC and a keypair (payer/mint signer).
 *   # Still creates + confirms a real ephemeral ALT on-chain (a cheap tx), so the
 *   # keypair must be funded even in simulate mode.
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
  AddressLookupTableAccount,
  AddressLookupTableProgram,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";

// Import from the package index (not deep paths): the index evaluates `./sdk`
// before `./onlineSdk`, which is the order that avoids the sdk<->onlineSdk
// circular-init ordering issue. This is also how real consumers import.
import { OnlinePumpSdk, PUMP_SDK, USDC_MINT } from "../src";

function loadKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))),
  );
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Collect the unique account keys referenced across `ixs` (including each
 * instruction's programId), EXCLUDING the static signer keys (`exclude`). The
 * payer and the mint keypair must remain static signer keys in the compiled
 * message — they cannot be sourced from an ALT — so we never put them in the
 * lookup table.
 */
function altAddresses(
  ixs: TransactionInstruction[],
  exclude: PublicKey[],
): PublicKey[] {
  const excluded = new Set(exclude.map((k) => k.toBase58()));
  const seen = new Map<string, PublicKey>();
  for (const ix of ixs) {
    const candidates = [ix.programId, ...ix.keys.map((k) => k.pubkey)];
    for (const key of candidates) {
      const b58 = key.toBase58();
      if (excluded.has(b58)) continue;
      if (!seen.has(b58)) seen.set(b58, key);
    }
  }
  return [...seen.values()];
}

/**
 * Create an ephemeral ALT over `addresses`, then poll until it is fetchable and
 * populated. A newly created table can only be referenced once the slot it was
 * created in is confirmed, so we bound-poll `getAddressLookupTable` (re-fetching
 * the slot too) with a short delay between tries.
 *
 * PRODUCTION NOTE: launching many coins should reuse ONE long-lived ALT of the
 * static pump accounts (global, programs, fee recipients, etc.) rather than
 * creating + paying for a fresh ephemeral table per launch.
 */
async function buildEphemeralAlt(
  connection: Connection,
  payer: Keypair,
  addresses: PublicKey[],
): Promise<AddressLookupTableAccount> {
  const recentSlot = await connection.getSlot("finalized");
  const [createIx, altAddress] = AddressLookupTableProgram.createLookupTable({
    authority: payer.publicKey,
    payer: payer.publicKey,
    recentSlot,
  });

  const sendIxs = async (instructions: TransactionInstruction[]): Promise<void> => {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const message = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    tx.sign([payer]);
    const sig = await connection.sendTransaction(tx);
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  };

  // `extendLookupTable` with many addresses overflows a single tx, so extend in
  // batches (~20 addresses/tx). The create + first batch share one tx.
  const BATCH = 20;
  const extendFor = (addrs: PublicKey[]) =>
    AddressLookupTableProgram.extendLookupTable({
      lookupTable: altAddress,
      authority: payer.publicKey,
      payer: payer.publicKey,
      addresses: addrs,
    });
  await sendIxs([createIx, extendFor(addresses.slice(0, BATCH))]);
  for (let i = BATCH; i < addresses.length; i += BATCH) {
    await sendIxs([extendFor(addresses.slice(i, i + BATCH))]);
  }
  console.log("created ephemeral ALT:", altAddress.toBase58());

  // Bound-poll until the ALT resolves and is populated. A freshly-extended table
  // can only be referenced starting the slot AFTER its last extension, so once the
  // addresses are present we also wait for the slot to advance before returning.
  for (let attempt = 0; attempt < 30; attempt++) {
    const fetched = await connection.getAddressLookupTable(altAddress);
    const account = fetched.value;
    if (account && account.state.addresses.length >= addresses.length) {
      const warmAt = await connection.getSlot();
      while ((await connection.getSlot()) <= warmAt + 1) await sleep(400);
      const ready = (await connection.getAddressLookupTable(altAddress)).value!;
      console.log("ALT active with", ready.state.addresses.length, "addresses");
      return ready;
    }
    await sleep(800);
  }
  throw new Error(`ALT ${altAddress.toBase58()} did not activate in time`);
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

  // Fetch global once and call the lower-level builder directly so we can pass an
  // explicit `amount` (1.5% of supply). The OnlinePumpSdk wrapper instead derives
  // `amount` from `solAmount` and does not take `global`/`amount`.
  const global = await sdk.fetchGlobal();
  const ixs = await PUMP_SDK.createV2AndBuyInstructions({
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

  // The USDC create+buy is too large for a single tx; build an ALT over the
  // static (non-signer) accounts. The payer and mint stay as static signer keys.
  const altAccount = await buildEphemeralAlt(
    connection,
    payer,
    altAddresses(ixs, [payer.publicKey, mint.publicKey]),
  );

  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ...ixs,
    ],
  }).compileToV0Message([altAccount]);
  const tx = new VersionedTransaction(message);
  tx.sign([payer, mint]);

  console.log("create+buy v0 tx size (bytes):", tx.serialize().length);

  const sim = await connection.simulateTransaction(tx, { sigVerify: false });
  console.log("simulate err:", sim.value.err);
  console.log((sim.value.logs ?? []).slice(-15).join("\n"));
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
