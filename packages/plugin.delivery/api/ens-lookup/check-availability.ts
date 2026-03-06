import { namehash } from './keccak256.js';

export const config = { runtime: 'edge' };

const ETH_RPC = 'https://eth.llamarpc.com';
const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';

function isValidName(name: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name);
}

/**
 * Check if ENS/SNS name is available
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
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing required field: name' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cleanName = name.trim().toLowerCase().replace(/\.(eth|sol)$/, '');

    if (!isValidName(cleanName)) {
      return new Response(JSON.stringify({
        error: 'Invalid name format. Use alphanumeric characters and hyphens only.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const availability: Record<string, { available: boolean; fullName: string; owner?: string }> = {};

    // Check .sol availability via Bonfida SNS
    try {
      const solRes = await fetch(`https://sns-sdk-proxy.bonfida.workers.dev/resolve/${cleanName}`);
      if (solRes.ok) {
        const solData = await solRes.json();
        const owner = solData.result || solData.s;
        if (owner) {
          availability.sol = { available: false, fullName: `${cleanName}.sol`, owner };
        } else {
          availability.sol = { available: true, fullName: `${cleanName}.sol` };
        }
      } else {
        availability.sol = { available: true, fullName: `${cleanName}.sol` };
      }
    } catch {
      availability.sol = { available: true, fullName: `${cleanName}.sol` };
    }

    // Check .eth availability via ENS registry
    try {
      if (cleanName.length < 3) {
        // ENS names < 3 chars are not registrable
        availability.eth = { available: false, fullName: `${cleanName}.eth` };
      } else {
        const fullName = `${cleanName}.eth`;
        const node = namehash(fullName);

        // Query ENS registry for resolver — if no resolver, name is available
        const resolverResp = await fetch(ETH_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 1, method: 'eth_call',
            params: [{ to: ENS_REGISTRY, data: '0x0178b8bf' + node.slice(2) }, 'latest'],
          }),
        });
        const resolverJson = await resolverResp.json();
        const resolverResult = resolverJson.result;

        const isZero = !resolverResult || resolverResult === '0x' + '0'.repeat(64);
        if (isZero) {
          availability.eth = { available: true, fullName };
        } else {
          // Has resolver — name is taken. Try to get the owner.
          const ownerResp = await fetch(ETH_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0', id: 2, method: 'eth_call',
              params: [{ to: ENS_REGISTRY, data: '0x02571be3' + node.slice(2) }, 'latest'],
            }),
          });
          const ownerJson = await ownerResp.json();
          const ownerResult = ownerJson.result;
          const ownerAddr = ownerResult && ownerResult !== '0x' + '0'.repeat(64)
            ? '0x' + ownerResult.slice(26)
            : undefined;
          availability.eth = { available: false, fullName, owner: ownerAddr };
        }
      }
    } catch {
      availability.eth = { available: false, fullName: `${cleanName}.eth` };
    }

    return new Response(JSON.stringify({
      success: true,
      data: { name: cleanName, availability },
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
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
