export const config = { runtime: 'edge' };

const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

/**
 * Fee Sharing in the Pump protocol:
 *
 * - Creators can configure fee sharing with up to 8 shareholders
 * - Shares are specified in BPS (basis points), must total exactly 10,000
 * - A SharingConfig PDA stores the shareholder list + splits
 * - CreatorVault PDA accumulates fees for later distribution
 * - There's a minimum distributable fee threshold
 */

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

    // First verify the token exists (bonding curve lookup)
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

    // Look for fee sharing config accounts
    // SharingConfig PDA seeds: ["sharing-config", mint]
    // We search for accounts owned by PumpFees program
    const PUMP_FEE_PROGRAM_ID = 'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ';

    const feeSharingAccounts = await rpcCall('getProgramAccounts', [
      PUMP_FEE_PROGRAM_ID,
      {
        encoding: 'base64',
        filters: [
          { memcmp: { offset: 8, bytes: mint, encoding: 'base58' } },
        ],
      },
    ]);

    const result: Record<string, any> = {
      mint,
      bondingCurveAddress: bcResult[0].pubkey,
    };

    if (feeSharingAccounts && feeSharingAccounts.length > 0) {
      result.feeSharingEnabled = true;
      result.sharingConfigAddress = feeSharingAccounts[0].pubkey;

      // Parse sharing config
      try {
        const rawData = Uint8Array.from(
          atob(feeSharingAccounts[0].account.data[0]),
          (c) => c.charCodeAt(0),
        );
        const view = new DataView(rawData.buffer, rawData.byteOffset);

        // SharingConfig layout (approximate):
        // discriminator (8) + mint (32) + creator (32) + numShareholders (1/4) + shareholders array
        // Each shareholder: pubkey (32) + shareBps (2)

        result.sharingConfigDataSize = rawData.length;
        result.note = 'Fee sharing is configured for this token. Creator fees are split among shareholders according to BPS shares that total 10,000.';
      } catch {
        result.sharingConfigParseError = 'Could not fully parse sharing config — raw account data available';
      }

      result.feeSharingInfo = {
        maxShareholders: 8,
        totalBps: 10_000,
        description: 'Shares must total exactly 10,000 BPS. Up to 8 shareholders can be configured.',
        programs: {
          pumpFees: PUMP_FEE_PROGRAM_ID,
          pump: PUMP_PROGRAM_ID,
        },
      };
    } else {
      result.feeSharingEnabled = false;
      result.message = 'No fee sharing configuration found for this token. The creator has not set up fee sharing, or this is not a Pump.fun token with fee sharing enabled.';

      result.feeSharingInfo = {
        howToEnable: 'Token creators can configure fee sharing via the PumpFees program by calling configureFeeSharing with a list of shareholders and their BPS splits.',
        maxShareholders: 8,
        totalBps: 10_000,
        programs: {
          pumpFees: PUMP_FEE_PROGRAM_ID,
          pump: PUMP_PROGRAM_ID,
        },
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to fetch fee sharing config' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
