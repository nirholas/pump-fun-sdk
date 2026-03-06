import { PublicKey } from "@solana/web3.js";
import type { ResourceResult } from "../types.js";

export function readAddressResource(address: string): ResourceResult {
  try {
    const pubKey = new PublicKey(address);
    const isOnCurve = PublicKey.isOnCurve(pubKey.toBytes());

    return {
      contents: [
        {
          uri: `solana://address/${address}`,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              address,
              valid: true,
              isOnCurve,
              type: isOnCurve ? "standard_keypair" : "program_derived_address",
              bytes: Array.from(pubKey.toBytes()),
              base58: pubKey.toBase58(),
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (err) {
    return {
      contents: [
        {
          uri: `solana://address/${address}`,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              address,
              valid: false,
              error: err instanceof Error ? err.message : "Invalid address",
            },
            null,
            2,
          ),
        },
      ],
    };
  }
}
