export const config = { runtime: 'edge' };

const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

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

async function findBondingCurveAccount(mint: string) {
  const mintBytes = base58Decode(mint);
  const result = await rpcCall('getProgramAccounts', [
    PUMP_PROGRAM_ID,
    {
      encoding: 'base64',
      filters: [
        { dataSize: 145 },
        { memcmp: { offset: 42, bytes: mint, encoding: 'base58' } },
      ],
    },
  ]);

  if (!result || result.length === 0) return null;

  const rawData = Uint8Array.from(
    atob(result[0].account.data[0]),
    (c) => c.charCodeAt(0),
  );
  return { pubkey: result[0].pubkey, data: rawData };
}

function parseBondingCurve(data: Uint8Array) {
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

/**
 * Bonding curve AMM formula: xy = k (constant product)
 * Buy: tokenOut = virtualTokenReserves - k / (virtualSolReserves + solIn)
 * Sell: solOut = virtualSolReserves - k / (virtualTokenReserves + tokenIn)
 */
function calculateBuy(bc: ReturnType<typeof parseBondingCurve>, solAmountLamports: bigint) {
  if (bc.complete) return { tokenAmount: 0n, error: 'Bonding curve graduated — trade on AMM' };

  const k = bc.virtualTokenReserves * bc.virtualSolReserves;
  const newVirtualSol = bc.virtualSolReserves + solAmountLamports;
  const newVirtualTokens = k / newVirtualSol;
  const tokensOut = bc.virtualTokenReserves - newVirtualTokens;

  // Cap at available real tokens
  const capped = tokensOut > bc.realTokenReserves ? bc.realTokenReserves : tokensOut;

  return { tokenAmount: capped, error: null };
}

function calculateSell(bc: ReturnType<typeof parseBondingCurve>, tokenAmount: bigint) {
  if (bc.complete) return { solAmount: 0n, error: 'Bonding curve graduated — trade on AMM' };

  const k = bc.virtualTokenReserves * bc.virtualSolReserves;
  const newVirtualTokens = bc.virtualTokenReserves + tokenAmount;
  const newVirtualSol = k / newVirtualTokens;
  const solOut = bc.virtualSolReserves - newVirtualSol;

  // Cap at available real SOL
  const capped = solOut > bc.realSolReserves ? bc.realSolReserves : solOut;

  return { solAmount: capped, error: null };
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
    const { mint, side, amount } = body;

    if (!mint) {
      return new Response(JSON.stringify({ error: 'mint is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!side || !['buy', 'sell'].includes(side)) {
      return new Response(JSON.stringify({ error: 'side must be "buy" or "sell"' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!amount) {
      return new Response(JSON.stringify({ error: 'amount is required (lamports for buy, raw token units for sell)' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const account = await findBondingCurveAccount(mint);
    if (!account) {
      return new Response(
        JSON.stringify({ error: 'Bonding curve not found. Token may not be a Pump.fun token.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const bc = parseBondingCurve(account.data);
    const amountBigInt = BigInt(amount);

    if (side === 'buy') {
      const result = calculateBuy(bc, amountBigInt);
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: 400, headers: { 'Content-Type': 'application/json' },
        });
      }
      const tokenAmountHuman = Number(result.tokenAmount) / 1e6;
      const solAmountHuman = Number(amountBigInt) / 1e9;
      const effectivePrice = solAmountHuman / tokenAmountHuman;

      return new Response(JSON.stringify({
        mint,
        side: 'buy',
        inputSolLamports: amount,
        inputSol: solAmountHuman.toFixed(9),
        outputTokens: result.tokenAmount.toString(),
        outputTokensHuman: tokenAmountHuman.toFixed(6),
        effectivePriceSolPerToken: effectivePrice.toFixed(12),
        bondingCurveComplete: bc.complete,
      }), { headers: { 'Content-Type': 'application/json' } });
    } else {
      const result = calculateSell(bc, amountBigInt);
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: 400, headers: { 'Content-Type': 'application/json' },
        });
      }
      const solAmountHuman = Number(result.solAmount) / 1e9;
      const tokenAmountHuman = Number(amountBigInt) / 1e6;
      const effectivePrice = tokenAmountHuman > 0 ? solAmountHuman / tokenAmountHuman : 0;

      return new Response(JSON.stringify({
        mint,
        side: 'sell',
        inputTokens: amount,
        inputTokensHuman: tokenAmountHuman.toFixed(6),
        outputSolLamports: result.solAmount.toString(),
        outputSol: solAmountHuman.toFixed(9),
        effectivePriceSolPerToken: effectivePrice.toFixed(12),
        bondingCurveComplete: bc.complete,
      }), { headers: { 'Content-Type': 'application/json' } });
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to calculate price quote' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
