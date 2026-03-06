export const config = { runtime: 'edge' };

const SOLANA_RPC = typeof process !== 'undefined' && process.env?.SOLANA_RPC_URL
  ? process.env.SOLANA_RPC_URL
  : 'https://api.mainnet-beta.solana.com';

const PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function isValidBase58(str: string): boolean {
  return str.length >= 32 && str.length <= 44 && [...str].every(c => BASE58_CHARS.includes(c));
}

/**
 * Check if token is honeypot
 */
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const mint = body.mint || body.address;
    const chain = (body.chain || 'solana').toLowerCase();

    if (!mint || typeof mint !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing required field: mint' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (chain === 'solana') {
      if (!isValidBase58(mint)) {
        return new Response(JSON.stringify({ error: 'Invalid Solana address (not valid base58)' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Fetch mint account info
      const mintInfoRes = await fetch(SOLANA_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getAccountInfo',
          params: [mint, { encoding: 'jsonParsed' }],
        }),
      });
      const mintInfoJson = await mintInfoRes.json();
      const accountData = mintInfoJson.result?.value;

      if (!accountData) {
        return new Response(JSON.stringify({ error: 'Token mint not found on-chain', mint }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const parsed = accountData.data?.parsed;
      const info = parsed?.info || {};

      const hasFreezeAuthority = !!info.freezeAuthority;

      // Check if PumpFun bonding curve token
      let bondingCurveActive = false;
      try {
        const bcRes = await fetch(SOLANA_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'getProgramAccounts',
            params: [PUMP_PROGRAM_ID, {
              filters: [{ memcmp: { offset: 30, bytes: mint } }],
              dataSlice: { offset: 0, length: 1 },
            }],
          }),
        });
        const bcJson = await bcRes.json();
        bondingCurveActive = bcJson.result && bcJson.result.length > 0;
      } catch {
        // Continue without bonding curve check
      }

      // Fetch largest token holders to check concentration
      let topHolderConcentration = 0;
      try {
        const holdersRes = await fetch(SOLANA_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 3,
            method: 'getTokenLargestAccounts',
            params: [mint],
          }),
        });
        const holdersJson = await holdersRes.json();
        const holders = holdersJson.result?.value || [];
        const totalSupply = Number(info.supply || 0);
        if (holders.length > 0 && totalSupply > 0) {
          const topAmount = Number(holders[0].amount || 0);
          topHolderConcentration = parseFloat(((topAmount / totalSupply) * 100).toFixed(2));
        }
      } catch {
        // Continue without holder data
      }

      // Determine honeypot risk
      let isHoneypot = false;
      let confidence = 'high';
      let reason = '';

      if (bondingCurveActive) {
        isHoneypot = false;
        confidence = 'high';
        reason = 'PumpFun bonding curve — sells are guaranteed by AMM';
      } else if (hasFreezeAuthority) {
        isHoneypot = true;
        confidence = 'medium';
        reason = 'Token has active freeze authority — holder tokens can be frozen';
      } else if (topHolderConcentration > 90) {
        isHoneypot = false;
        confidence = 'low';
        reason = `Extreme top holder concentration (${topHolderConcentration}%) — potential rug pull risk`;
      } else {
        isHoneypot = false;
        confidence = 'medium';
        reason = 'No obvious honeypot indicators detected';
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          mint,
          isHoneypot,
          confidence,
          reason,
          checks: {
            freezeAuthority: hasFreezeAuthority,
            topHolderConcentration,
            bondingCurveActive,
          },
        },
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Unsupported chain: ${chain}. Currently only Solana is supported.` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Server error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

