export const config = { runtime: 'edge' };

const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

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

    // Find bonding curve account
    const bcResult = await rpcCall('getProgramAccounts', [
      PUMP_PROGRAM_ID,
      {
        encoding: 'base64',
        filters: [
          { dataSize: 145 },
          { memcmp: { offset: 42, bytes: mint, encoding: 'base58' } },
        ],
      },
    ]);

    if (!bcResult || bcResult.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Bonding curve not found. Token may not be a Pump.fun token.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const rawData = Uint8Array.from(
      atob(bcResult[0].account.data[0]),
      (c) => c.charCodeAt(0),
    );
    const view = new DataView(rawData.buffer, rawData.byteOffset);
    const readU64 = (offset: number): bigint => {
      const lo = BigInt(view.getUint32(offset, true));
      const hi = BigInt(view.getUint32(offset + 4, true));
      return (hi << 32n) | lo;
    };

    const virtualTokenReserves = readU64(8);
    const virtualSolReserves = readU64(16);
    const realTokenReserves = readU64(24);
    const realSolReserves = readU64(32);
    const tokenTotalSupply = readU64(40);
    const complete = rawData[48] === 1;

    // Market cap = price_per_token * total_supply
    // price_per_token = virtualSolReserves / virtualTokenReserves
    const pricePerTokenLamports =
      virtualTokenReserves > 0n
        ? Number(virtualSolReserves) / Number(virtualTokenReserves)
        : 0;

    // Total supply is 1B tokens with 6 decimals
    const totalSupplyTokens = Number(tokenTotalSupply) / 1e6;
    const marketCapLamports = pricePerTokenLamports * Number(tokenTotalSupply);
    const marketCapSol = marketCapLamports / 1e9;

    // Fetch SOL/USD price from a public API for USD conversion
    let solPriceUsd = 0;
    let marketCapUsd = 0;
    try {
      const priceRes = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
        { headers: { Accept: 'application/json' } },
      );
      const priceData = await priceRes.json() as any;
      solPriceUsd = priceData?.solana?.usd || 0;
      marketCapUsd = marketCapSol * solPriceUsd;
    } catch {
      // USD price unavailable — continue without it
    }

    return new Response(JSON.stringify({
      mint,
      pricePerTokenLamports: pricePerTokenLamports.toFixed(6),
      pricePerTokenSol: (pricePerTokenLamports).toFixed(12),
      totalSupplyTokens: totalSupplyTokens.toLocaleString(),
      marketCapSol: marketCapSol.toFixed(4),
      marketCapUsd: marketCapUsd > 0 ? marketCapUsd.toFixed(2) : 'unavailable',
      solPriceUsd: solPriceUsd > 0 ? solPriceUsd.toFixed(2) : 'unavailable',
      graduated: complete,
      bondingCurveAddress: bcResult[0].pubkey,
      realSolReservesSol: (Number(realSolReserves) / 1e9).toFixed(4),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to calculate market cap' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
