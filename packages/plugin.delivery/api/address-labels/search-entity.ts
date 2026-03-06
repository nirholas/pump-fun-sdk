export const config = { runtime: 'edge' };

const KNOWN_LABELS = [
  // PumpFun
  { address: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P', label: 'Pump Program', entity: 'PumpFun', chain: 'solana' },
  { address: 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA', label: 'PumpAMM Program', entity: 'PumpFun', chain: 'solana' },
  { address: 'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ', label: 'PumpFees Program', entity: 'PumpFun', chain: 'solana' },
  // Jupiter
  { address: 'JUP6LkMUje1knDPNBwLoXkTQYDKCLEacpZZHK3YVcVoM', label: 'Jupiter v6 Aggregator', entity: 'Jupiter', chain: 'solana' },
  { address: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB', label: 'Jupiter v4 Aggregator', entity: 'Jupiter', chain: 'solana' },
  // Raydium
  { address: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', label: 'Raydium AMM v4', entity: 'Raydium', chain: 'solana' },
  { address: 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK', label: 'Raydium CLMM', entity: 'Raydium', chain: 'solana' },
  // Orca
  { address: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', label: 'Orca Whirlpools', entity: 'Orca', chain: 'solana' },
  // Marinade
  { address: 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD', label: 'Marinade Finance', entity: 'Marinade', chain: 'solana' },
  // Solana System
  { address: '11111111111111111111111111111111', label: 'System Program', entity: 'Solana', chain: 'solana' },
  { address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', label: 'SPL Token Program', entity: 'Solana', chain: 'solana' },
  { address: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', label: 'Token-2022 Program', entity: 'Solana', chain: 'solana' },
  { address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', label: 'Associated Token Account Program', entity: 'Solana', chain: 'solana' },
  { address: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s', label: 'Metaplex Token Metadata', entity: 'Metaplex', chain: 'solana' },
  { address: 'ComputeBudget111111111111111111111111111111', label: 'Compute Budget Program', entity: 'Solana', chain: 'solana' },
  // Ethereum
  { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', label: 'USDT', entity: 'Tether', chain: 'ethereum' },
  { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', label: 'USDC', entity: 'Circle', chain: 'ethereum' },
  { address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', label: 'Uniswap V2 Router', entity: 'Uniswap', chain: 'ethereum' },
  { address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', label: 'Uniswap V3 Router', entity: 'Uniswap', chain: 'ethereum' },
  { address: '0x1111111254EEB25477B68fb85Ed929f73A960582', label: '1inch V5 Router', entity: '1inch', chain: 'ethereum' },
];

/**
 * Search for entity by name
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
    const { query, chain } = body;

    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing required field: query' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const q = query.toLowerCase();
    const results = KNOWN_LABELS.filter(l => {
      const matchesQuery = l.entity.toLowerCase().includes(q) || l.label.toLowerCase().includes(q);
      const matchesChain = !chain || l.chain.toLowerCase() === chain.toLowerCase();
      return matchesQuery && matchesChain;
    }).map(({ address, label, chain }) => ({ address, label, chain }));

    return new Response(JSON.stringify({
      success: true,
      data: { query, results },
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

