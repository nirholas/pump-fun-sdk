export const config = { runtime: 'edge' };

const SOLANA_RPC = typeof process !== 'undefined' && process.env?.SOLANA_RPC_URL
  ? process.env.SOLANA_RPC_URL
  : 'https://api.mainnet-beta.solana.com';

const PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function isValidBase58(str: string): boolean {
  return str.length >= 32 && str.length <= 44 && [...str].every(c => BASE58_CHARS.includes(c));
}

interface ScanCheck {
  status: 'pass' | 'warn' | 'fail' | 'info';
  detail: string;
}

/**
 * Scan token for security risks
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
      const checks: Record<string, ScanCheck> = {};
      const flags: string[] = [];
      let score = 100;

      // Check program
      const owner = accountData.owner;
      const programName = owner === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
        ? 'SPL Token Program'
        : owner === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
        ? 'Token-2022 Program'
        : owner;
      checks.program = { status: 'info', detail: programName };

      // Check mint authority
      if (info.mintAuthority) {
        checks.mintAuthority = { status: 'warn', detail: `Mint authority active: ${info.mintAuthority}` };
        flags.push('mint_authority_active');
        score -= 15;
      } else {
        checks.mintAuthority = { status: 'pass', detail: 'Mint authority revoked' };
      }

      // Check freeze authority
      if (info.freezeAuthority) {
        checks.freezeAuthority = { status: 'fail', detail: `Freeze authority active: ${info.freezeAuthority}` };
        flags.push('freeze_authority_active');
        score -= 25;
      } else {
        checks.freezeAuthority = { status: 'pass', detail: 'No freeze authority' };
      }

      // Check supply
      const supply = info.supply ? BigInt(info.supply) : BigInt(0);
      const decimals = info.decimals || 0;
      const displaySupply = Number(supply) / Math.pow(10, decimals);
      checks.supply = { status: 'pass', detail: `${displaySupply.toLocaleString()} tokens (${decimals} decimals)` };

      // Check if PumpFun token by attempting bonding curve PDA lookup
      let isPumpToken = false;
      try {
        // Simple heuristic: check if account owner is the Pump program
        // A more thorough check would derive the bonding curve PDA
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
        if (bcJson.result && bcJson.result.length > 0) {
          isPumpToken = true;
          checks.bondingCurve = { status: 'info', detail: 'PumpFun bonding curve token detected' };
        }
      } catch {
        // Silently continue if PDA lookup fails
      }

      if (!isPumpToken) {
        checks.bondingCurve = { status: 'info', detail: 'Not a PumpFun bonding curve token' };
      }

      const riskLevel = score >= 80 ? 'low' : score >= 50 ? 'medium' : 'high';

      return new Response(JSON.stringify({
        success: true,
        data: {
          mint,
          chain: 'solana',
          riskLevel,
          checks,
          score: Math.max(0, score),
          flags,
          isPumpToken,
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

