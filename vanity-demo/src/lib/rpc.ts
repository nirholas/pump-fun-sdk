import { Connection } from "@solana/web3.js";

export function mainnetConnection(): Connection {
  const url =
    process.env["NEXT_PUBLIC_MAINNET_RPC_URL"] ??
    "https://api.mainnet-beta.solana.com";
  return new Connection(url, "confirmed");
}

export function devnetConnection(): Connection {
  const url =
    process.env["NEXT_PUBLIC_DEVNET_RPC_URL"] ??
    "https://api.devnet.solana.com";
  return new Connection(url, "confirmed");
}
