import { Connection, PublicKey } from "@solana/web3.js";
import { PUMP_PROGRAM_ID, PUMP_SDK } from "@nirholas/pump-sdk";

export interface RecentMint {
  signature: string;
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  blockTime: number;
  endsWithPump: boolean;
}

export async function fetchRecentMints(
  connection: Connection,
  limit = 20,
): Promise<RecentMint[]> {
  const sigs = await connection.getSignaturesForAddress(
    new PublicKey(PUMP_PROGRAM_ID),
    { limit: 100 },
    "confirmed",
  );

  const results: RecentMint[] = [];

  for (const sigInfo of sigs) {
    if (results.length >= limit) break;
    if (sigInfo.err) continue;

    try {
      const tx = await connection.getTransaction(sigInfo.signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (!tx?.meta?.logMessages) continue;

      for (const log of tx.meta.logMessages) {
        if (!log.startsWith("Program data: ")) continue;
        const b64 = log.slice("Program data: ".length);
        const buf = Buffer.from(b64, "base64");
        const event = PUMP_SDK.decodeCreateEvent(buf);
        if (!event) continue;

        const mint = event.mint.toBase58();
        results.push({
          signature: sigInfo.signature,
          mint,
          name: event.name,
          symbol: event.symbol,
          creator: event.user.toBase58(),
          blockTime: tx.blockTime ?? 0,
          endsWithPump: mint.toLowerCase().endsWith("pump"),
        });
        break;
      }
    } catch {
      // skip malformed or non-create txs
    }
  }

  return results;
}
