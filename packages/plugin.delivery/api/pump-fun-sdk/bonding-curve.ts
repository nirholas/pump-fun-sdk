export const config = { runtime: 'edge' };

const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

// Pump program constants
const PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const PUMP_AMM_PROGRAM_ID = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';

// Bonding curve seed
const BONDING_CURVE_SEED = 'bonding-curve';

// Token supply and virtual reserves (from SDK constants)
const TOKEN_TOTAL_SUPPLY = 1_000_000_000_000_000n; // 1B tokens * 10^6
const INITIAL_VIRTUAL_TOKEN_RESERVES = 1_073_000_000_000_000n;
const INITIAL_VIRTUAL_SOL_RESERVES = 30_000_000_000n; // 30 SOL in lamports

async function rpcCall(method: string, params: any[]) {
  const response = await fetch(SOLANA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await response.json() as any;
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

function base58Decode(str: string): Uint8Array {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const bytes: number[] = [];
  for (const char of str) {
    const idx = ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base58 char: ${char}`);
    let carry = idx;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of str) {
    if (char === '1') bytes.push(0);
    else break;
  }
  return new Uint8Array(bytes.reverse());
}

function base58Encode(bytes: Uint8Array): string {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const result: number[] = [];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < result.length; j++) {
      carry += result[j] << 8;
      result[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      result.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  for (const byte of bytes) {
    if (byte === 0) result.push(0);
    else break;
  }
  return result.reverse().map((i) => ALPHABET[i]).join('');
}

// Derive bonding curve PDA
async function findBondingCurvePda(mintBytes: Uint8Array): Promise<string> {
  // We use the RPC to find the account via getProgramAccounts with a memcmp filter
  // But since we need the PDA, let's use a simpler approach — call getAccountInfo
  // with the known PDA derivation
  const encoder = new TextEncoder();
  const seedPrefix = encoder.encode(BONDING_CURVE_SEED);
  const programIdBytes = base58Decode(PUMP_PROGRAM_ID);

  // SHA-256 based PDA derivation (simplified — in production use @solana/web3.js)
  // For the edge function we call the RPC to find the account instead
  // We'll search for the bonding curve account by mint using getProgramAccounts
  const result = await rpcCall('getProgramAccounts', [
    PUMP_PROGRAM_ID,
    {
      encoding: 'base64',
      filters: [
        { dataSize: 145 }, // BondingCurve account size
        { memcmp: { offset: 42, bytes: base58Encode(mintBytes), encoding: 'base58' } },
      ],
    },
  ]);

  if (!result || result.length === 0) return '';
  return result[0].pubkey;
}

// Parse bonding curve account data from base64
function parseBondingCurve(data: Buffer) {
  // Account layout (after 8-byte discriminator):
  // virtualTokenReserves: u64 (8 bytes) offset 8
  // virtualSolReserves:   u64 (8 bytes) offset 16
  // realTokenReserves:    u64 (8 bytes) offset 24
  // realSolReserves:      u64 (8 bytes) offset 32
  // tokenTotalSupply:     u64 (8 bytes) offset 40 — but actually this is the mint pubkey start
  // Actually: discriminator(8) + virtualTokenReserves(8) + virtualSolReserves(8) + realTokenReserves(8) + realSolReserves(8) + tokenTotalSupply(8) + complete(1)
  const view = new DataView(data.buffer, data.byteOffset);

  const readU64 = (offset: number): bigint => {
    const lo = BigInt(view.getUint32(offset, true));
    const hi = BigInt(view.getUint32(offset + 4, true));
    return (hi << 32n) | lo;
  };

  return {
    virtualTokenReserves: readU64(8),
    virtualSolReserves: readU64(16),
    realTokenReserves: readU64(24),
    realSolReserves: readU64(32),
    tokenTotalSupply: readU64(40),
    complete: data[48] === 1,
  };
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { mint } = body;

    if (!mint || typeof mint !== 'string') {
      return new Response(JSON.stringify({ error: 'mint address is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const mintBytes = base58Decode(mint);
    const bondingCurvePubkey = await findBondingCurvePda(mintBytes);

    if (!bondingCurvePubkey) {
      return new Response(
        JSON.stringify({ error: 'Bonding curve not found for this mint. Token may not be a Pump.fun token.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const accountInfo = await rpcCall('getAccountInfo', [
      bondingCurvePubkey,
      { encoding: 'base64' },
    ]);

    if (!accountInfo?.value) {
      return new Response(
        JSON.stringify({ error: 'Bonding curve account not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const rawData = Uint8Array.from(atob(accountInfo.value.data[0]), (c) => c.charCodeAt(0));
    const bc = parseBondingCurve(Buffer.from(rawData));

    // Calculate current price (SOL per token)
    const pricePerToken =
      bc.virtualTokenReserves > 0n
        ? Number(bc.virtualSolReserves) / Number(bc.virtualTokenReserves)
        : 0;

    // Calculate progress toward graduation
    const totalSolNeeded = 85_000_000_000n; // ~85 SOL to graduate
    const progressPct = bc.realSolReserves > 0n
      ? Math.min(100, (Number(bc.realSolReserves) / Number(totalSolNeeded)) * 100)
      : 0;

    return new Response(
      JSON.stringify({
        mint,
        bondingCurveAddress: bondingCurvePubkey,
        virtualTokenReserves: bc.virtualTokenReserves.toString(),
        virtualSolReserves: bc.virtualSolReserves.toString(),
        realTokenReserves: bc.realTokenReserves.toString(),
        realSolReserves: bc.realSolReserves.toString(),
        tokenTotalSupply: bc.tokenTotalSupply.toString(),
        complete: bc.complete,
        graduated: bc.complete,
        pricePerTokenLamports: pricePerToken.toFixed(6),
        pricePerTokenSol: (pricePerToken / 1).toFixed(12),
        graduationProgressPct: progressPct.toFixed(2),
        realSolReservesSol: (Number(bc.realSolReserves) / 1e9).toFixed(4),
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to fetch bonding curve' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
