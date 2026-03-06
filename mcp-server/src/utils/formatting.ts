import BN from "bn.js";

const LAMPORTS_PER_SOL = 1_000_000_000;
const TOKEN_DECIMALS = 6;
const TOKEN_MULTIPLIER = 10 ** TOKEN_DECIMALS;

export function lamportsToSol(lamports: BN): string {
  const whole = lamports.div(new BN(LAMPORTS_PER_SOL));
  const remainder = lamports.mod(new BN(LAMPORTS_PER_SOL));
  const decimal = remainder.toString().padStart(9, "0").replace(/0+$/, "");
  return decimal ? `${whole}.${decimal}` : whole.toString();
}

export function solToLamports(sol: string): BN {
  const parts = sol.split(".");
  const wholePart = parts[0] ?? "0";
  const fracPart = (parts[1] ?? "").padEnd(9, "0").slice(0, 9);
  return new BN(wholePart)
    .mul(new BN(LAMPORTS_PER_SOL))
    .add(new BN(fracPart));
}

export function rawToTokens(raw: BN): string {
  const whole = raw.div(new BN(TOKEN_MULTIPLIER));
  const remainder = raw.mod(new BN(TOKEN_MULTIPLIER));
  const decimal = remainder.toString().padStart(TOKEN_DECIMALS, "0").replace(/0+$/, "");
  return decimal ? `${whole}.${decimal}` : whole.toString();
}

export function tokensToRaw(tokens: string): BN {
  const parts = tokens.split(".");
  const wholePart = parts[0] ?? "0";
  const fracPart = (parts[1] ?? "").padEnd(TOKEN_DECIMALS, "0").slice(0, TOKEN_DECIMALS);
  return new BN(wholePart)
    .mul(new BN(TOKEN_MULTIPLIER))
    .add(new BN(fracPart));
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function formatBN(value: BN): string {
  return value.toString();
}

export function instructionsToJson(
  instructions: { programId: { toBase58(): string }; keys: { pubkey: { toBase58(): string }; isSigner: boolean; isWritable: boolean }[]; data: Buffer }[]
): object[] {
  return instructions.map((ix) => ({
    programId: ix.programId.toBase58(),
    accounts: ix.keys.map((k) => ({
      pubkey: k.pubkey.toBase58(),
      isSigner: k.isSigner,
      isWritable: k.isWritable,
    })),
    data: ix.data.toString("base64"),
  }));
}
