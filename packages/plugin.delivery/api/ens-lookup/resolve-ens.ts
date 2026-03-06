import { namehash } from './keccak256.js';

export const config = { runtime: 'edge' };

const ETH_RPC = 'https://eth.llamarpc.com';
const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';

function isBase58Address(addr: string): boolean {
  const base58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  return addr.length >= 32 && addr.length <= 44 && [...addr].every(c => base58.includes(c));
}

/**
 * Resolve ENS name to address
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

    const trimmed = name.trim().toLowerCase();

    // Handle .sol names via Bonfida SNS
    if (trimmed.endsWith('.sol')) {
      const domain = trimmed.replace(/\.sol$/, '');
      try {
        const response = await fetch(`https://sns-sdk-proxy.bonfida.workers.dev/resolve/${domain}`);
        if (response.ok) {
          const data = await response.json();
          const address = data.result || data.s;
          if (address) {
            return new Response(JSON.stringify({
              success: true,
              data: { name: trimmed, address, chain: 'solana', resolver: 'Bonfida SNS' },
            }), {
              headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
            });
          }
        }
        return new Response(JSON.stringify({
          success: true,
          data: { name: trimmed, address: null, chain: 'solana', error: 'Name not found' },
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to resolve .sol name via Bonfida SNS',
        }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Handle .eth names via ENS
    if (trimmed.endsWith('.eth') || !trimmed.includes('.')) {
      const fullName = trimmed.endsWith('.eth') ? trimmed : `${trimmed}.eth`;

      // Use eth_call to resolve via ENS universal resolver
      // Universal Resolver address on mainnet
      const UNIVERSAL_RESOLVER = '0xce01f8eee7E479C928F8919abD53E553a36CeF67';

      try {
        // Encode resolve(bytes,bytes) call — use a simpler approach via public API
        // For v1, use a well-known ENS resolution endpoint
        const response = await fetch(ETH_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_call',
            params: [{
              to: ENS_REGISTRY,
              data: '0x0178b8bf' + namehash(fullName).slice(2),
            }, 'latest'],
          }),
        });
        const json = await response.json();
        const resolver = json.result;

        if (resolver && resolver !== '0x' + '0'.repeat(64)) {
          const resolverAddr = '0x' + resolver.slice(26);
          // Call addr(bytes32) on resolver
          const addrRes = await fetch(ETH_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 2,
              method: 'eth_call',
              params: [{
                to: resolverAddr,
                data: '0x3b3b57de' + namehash(fullName).slice(2),
              }, 'latest'],
            }),
          });
          const addrJson = await addrRes.json();
          const address = addrJson.result;

          if (address && address !== '0x' + '0'.repeat(64)) {
            return new Response(JSON.stringify({
              success: true,
              data: {
                name: fullName,
                address: '0x' + address.slice(26),
                chain: 'ethereum',
                resolver: resolverAddr,
              },
            }), {
              headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
            });
          }
        }

        return new Response(JSON.stringify({
          success: true,
          data: { name: fullName, address: null, chain: 'ethereum', error: 'Name not resolved' },
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to resolve .eth name via ENS',
        }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Unsupported name format. Use .eth or .sol names.' }), {
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

