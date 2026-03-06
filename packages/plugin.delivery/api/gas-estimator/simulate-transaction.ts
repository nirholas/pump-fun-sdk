export const config = { runtime: 'edge' };

const SOLANA_RPC = typeof process !== 'undefined' && process.env?.SOLANA_RPC_URL
  ? process.env.SOLANA_RPC_URL
  : 'https://api.mainnet-beta.solana.com';

function isValidBase64(str: string): boolean {
  try {
    if (typeof atob === 'function') {
      atob(str);
      return true;
    }
    return /^[A-Za-z0-9+/]*={0,2}$/.test(str) && str.length % 4 === 0;
  } catch {
    return false;
  }
}

/**
 * Full transaction simulation
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
    const { transaction, chain } = body;

    if (!transaction || typeof transaction !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing required field: transaction (base64-encoded)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const targetChain = (chain || 'solana').toLowerCase();

    if (targetChain === 'solana') {
      if (!isValidBase64(transaction)) {
        return new Response(JSON.stringify({ error: 'Invalid base64-encoded transaction' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const response = await fetch(SOLANA_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'simulateTransaction',
          params: [
            transaction,
            {
              encoding: 'base64',
              replaceRecentBlockhash: true,
              commitment: 'confirmed',
            },
          ],
        }),
      });

      const json = await response.json();
      const result = json.result?.value;

      if (!result) {
        return new Response(JSON.stringify({
          success: false,
          error: json.error?.message || 'Simulation failed — no result returned',
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const success = result.err === null;
      const computeUnitsConsumed = result.unitsConsumed || 0;
      const estimatedFee = (5000 + computeUnitsConsumed * 0.00005) / 1e9;

      return new Response(JSON.stringify({
        success: true,
        data: {
          chain: 'solana',
          simulation: {
            success,
            error: result.err || null,
            computeUnitsConsumed,
            estimatedFee: parseFloat(estimatedFee.toFixed(9)),
            logs: result.logs || [],
            returnData: result.returnData || null,
          },
        },
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      error: `Simulation not supported for chain: ${targetChain}. Currently only Solana is supported.`,
    }), {
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

