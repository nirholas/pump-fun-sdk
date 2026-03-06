export const config = { runtime: 'edge' };

interface LabelEntry {
  address: string;
  label: string;
  entity: string;
  tags: string[];
  chain: string;
}

const KNOWN_LABELS: LabelEntry[] = [
  // Solana — PumpFun
  { address: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P', label: 'Pump Program', entity: 'PumpFun', tags: ['defi', 'token-launchpad', 'solana'], chain: 'solana' },
  { address: 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA', label: 'PumpAMM Program', entity: 'PumpFun', tags: ['defi', 'amm', 'solana'], chain: 'solana' },
  { address: 'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ', label: 'PumpFees Program', entity: 'PumpFun', tags: ['defi', 'fees', 'solana'], chain: 'solana' },
  // Solana — Jupiter
  { address: 'JUP6LkMUje1knDPNBwLoXkTQYDKCLEacpZZHK3YVcVoM', label: 'Jupiter v6 Aggregator', entity: 'Jupiter', tags: ['defi', 'aggregator', 'solana'], chain: 'solana' },
  { address: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB', label: 'Jupiter v4 Aggregator', entity: 'Jupiter', tags: ['defi', 'aggregator', 'solana'], chain: 'solana' },
  // Solana — Raydium
  { address: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', label: 'Raydium AMM v4', entity: 'Raydium', tags: ['defi', 'amm', 'solana'], chain: 'solana' },
  { address: 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK', label: 'Raydium CLMM', entity: 'Raydium', tags: ['defi', 'clmm', 'solana'], chain: 'solana' },
  // Solana — Orca
  { address: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', label: 'Orca Whirlpools', entity: 'Orca', tags: ['defi', 'amm', 'clmm', 'solana'], chain: 'solana' },
  // Solana — Marinade
  { address: 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD', label: 'Marinade Finance', entity: 'Marinade', tags: ['defi', 'staking', 'liquid-staking', 'solana'], chain: 'solana' },
  // Solana — System Programs
  { address: '11111111111111111111111111111111', label: 'System Program', entity: 'Solana', tags: ['system', 'solana'], chain: 'solana' },
  { address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', label: 'SPL Token Program', entity: 'Solana', tags: ['token', 'spl', 'solana'], chain: 'solana' },
  { address: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', label: 'Token-2022 Program', entity: 'Solana', tags: ['token', 'token-2022', 'solana'], chain: 'solana' },
  { address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', label: 'Associated Token Account Program', entity: 'Solana', tags: ['token', 'ata', 'solana'], chain: 'solana' },
  { address: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s', label: 'Metaplex Token Metadata', entity: 'Metaplex', tags: ['nft', 'metadata', 'solana'], chain: 'solana' },
  { address: 'SysvarRent111111111111111111111111111111111', label: 'Rent Sysvar', entity: 'Solana', tags: ['system', 'sysvar', 'solana'], chain: 'solana' },
  { address: 'ComputeBudget111111111111111111111111111111', label: 'Compute Budget Program', entity: 'Solana', tags: ['system', 'compute', 'solana'], chain: 'solana' },
  // Ethereum — Well-known
  { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', label: 'USDT', entity: 'Tether', tags: ['token', 'stablecoin', 'ethereum'], chain: 'ethereum' },
  { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', label: 'USDC', entity: 'Circle', tags: ['token', 'stablecoin', 'ethereum'], chain: 'ethereum' },
  { address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', label: 'Uniswap V2 Router', entity: 'Uniswap', tags: ['defi', 'router', 'ethereum'], chain: 'ethereum' },
  { address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', label: 'Uniswap V3 Router', entity: 'Uniswap', tags: ['defi', 'router', 'ethereum'], chain: 'ethereum' },
  { address: '0x1111111254EEB25477B68fb85Ed929f73A960582', label: '1inch V5 Router', entity: '1inch', tags: ['defi', 'aggregator', 'ethereum'], chain: 'ethereum' },
];

function detectChain(address: string): string {
  if (address.startsWith('0x')) return 'ethereum';
  return 'solana';
}

/**
 * Get label and entity info for address
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

    const chain = detectChain(address);
    const entry = KNOWN_LABELS.find(l => l.address.toLowerCase() === address.toLowerCase());

    if (entry) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          address: entry.address,
          label: `${entry.entity}: ${entry.label}`,
          entity: entry.entity,
          tags: entry.tags,
          chain: entry.chain,
        },
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        address,
        label: 'Unknown',
        entity: null,
        tags: [],
        chain,
      },
    }), {
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

