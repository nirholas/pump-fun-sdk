import { namehash } from './keccak256.js';

export const config = { runtime: 'edge' };

function isEthAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function isBase58Address(addr: string): boolean {
  const base58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  return addr.length >= 32 && addr.length <= 44 && [...addr].every(c => base58.includes(c));
}

const ETH_RPC = 'https://eth.llamarpc.com';
const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';

/**
 * Get ENS name for address (reverse resolution)
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
    const { address } = body;

    if (!address || typeof address !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing required field: address' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Solana address — use Bonfida favorite domain
    if (isBase58Address(address)) {
      try {
        const response = await fetch(`https://sns-sdk-proxy.bonfida.workers.dev/favorite-domain/${address}`);
        if (response.ok) {
          const data = await response.json();
          const domain = data.result || data.s;
          if (domain) {
            return new Response(JSON.stringify({
              success: true,
              data: { address, name: `${domain}.sol`, chain: 'solana' },
            }), {
              headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
            });
          }
        }
        return new Response(JSON.stringify({
          success: true,
          data: { address, name: null, chain: 'solana' },
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to reverse-resolve Solana address via Bonfida',
        }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Ethereum address — ENS reverse resolution via registry + resolver
    if (isEthAddress(address)) {
      try {
        const reverseAddr = address.toLowerCase().slice(2) + '.addr.reverse';
        const node = namehash(reverseAddr);

        // Step 1: Get the resolver for the reverse record
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

        if (resolverResult && resolverResult !== '0x' + '0'.repeat(64)) {
          const resolverAddr = '0x' + resolverResult.slice(26);

          // Step 2: Call name(bytes32) on the resolver — selector: 0x691f3431
          const nameResp = await fetch(ETH_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0', id: 2, method: 'eth_call',
              params: [{ to: resolverAddr, data: '0x691f3431' + node.slice(2) }, 'latest'],
            }),
          });
          const nameJson = await nameResp.json();
          const nameResult = nameJson.result;

          if (nameResult && nameResult.length > 130) {
            // ABI-decode string: offset (32 bytes) + length (32 bytes) + data
            const strLen = parseInt(nameResult.slice(66, 130), 16);
            if (strLen > 0 && strLen < 256) {
              const nameHex = nameResult.slice(130, 130 + strLen * 2);
              const nameBytes = new Uint8Array(strLen);
              for (let i = 0; i < strLen; i++) {
                nameBytes[i] = parseInt(nameHex.slice(i * 2, i * 2 + 2), 16);
              }
              const resolvedName = new TextDecoder().decode(nameBytes);

              if (resolvedName && resolvedName.includes('.')) {
                return new Response(JSON.stringify({
                  success: true,
                  data: { address, name: resolvedName, chain: 'ethereum', resolver: resolverAddr },
                }), {
                  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
                });
              }
            }
          }
        }

        return new Response(JSON.stringify({
          success: true,
          data: { address, name: null, chain: 'ethereum' },
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to reverse-resolve Ethereum address',
        }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({
      error: 'Invalid address format. Provide an Ethereum (0x...) or Solana (base58) address.',
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

