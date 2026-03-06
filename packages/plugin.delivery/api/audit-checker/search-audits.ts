export const config = { runtime: 'edge' };

const AUDIT_REGISTRY = [
  { protocol: 'PumpFun', chain: 'solana', auditCount: 1, latestAudit: '2026-03-06', firms: ['Internal'], tags: ['defi', 'token-launchpad', 'bonding-curve'] },
  { protocol: 'Jupiter', chain: 'solana', auditCount: 2, latestAudit: '2024-01-15', firms: ['OtterSec', 'Neodyme'], tags: ['defi', 'aggregator', 'swap'] },
  { protocol: 'Raydium', chain: 'solana', auditCount: 1, latestAudit: '2023-08-10', firms: ['MadShield'], tags: ['defi', 'amm', 'clmm'] },
  { protocol: 'Marinade Finance', chain: 'solana', auditCount: 2, latestAudit: '2023-06-05', firms: ['Neodyme', 'Ackee Blockchain'], tags: ['defi', 'staking', 'liquid-staking'] },
  { protocol: 'Orca', chain: 'solana', auditCount: 1, latestAudit: '2023-09-20', firms: ['Neodyme'], tags: ['defi', 'amm', 'whirlpools'] },
  { protocol: 'Solend', chain: 'solana', auditCount: 1, latestAudit: '2022-12-01', firms: ['Kudelski Security'], tags: ['defi', 'lending'] },
  { protocol: 'Uniswap', chain: 'ethereum', auditCount: 5, latestAudit: '2024-06-01', firms: ['OpenZeppelin', 'Trail of Bits', 'ABDK'], tags: ['defi', 'amm', 'swap'] },
  { protocol: 'Aave', chain: 'ethereum', auditCount: 8, latestAudit: '2024-03-15', firms: ['OpenZeppelin', 'SigmaPrime', 'Certora'], tags: ['defi', 'lending', 'flash-loans'] },
  { protocol: 'Compound', chain: 'ethereum', auditCount: 4, latestAudit: '2023-12-10', firms: ['OpenZeppelin', 'Trail of Bits'], tags: ['defi', 'lending'] },
  { protocol: 'Lido', chain: 'ethereum', auditCount: 6, latestAudit: '2024-02-20', firms: ['MixBytes', 'Statemind', 'Ackee'], tags: ['defi', 'staking', 'liquid-staking'] },
];

/**
 * Search audit database
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
    const { query, chain, firm } = body;

    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing required field: query' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const q = query.toLowerCase();
    let results = AUDIT_REGISTRY.filter(entry => {
      const matchesQuery =
        entry.protocol.toLowerCase().includes(q) ||
        entry.chain.toLowerCase().includes(q) ||
        entry.tags.some(t => t.includes(q)) ||
        entry.firms.some(f => f.toLowerCase().includes(q));
      const matchesChain = !chain || entry.chain.toLowerCase() === chain.toLowerCase();
      const matchesFirm = !firm || entry.firms.some(f => f.toLowerCase().includes(firm.toLowerCase()));
      return matchesQuery && matchesChain && matchesFirm;
    });

    results.sort((a, b) => b.latestAudit.localeCompare(a.latestAudit));

    return new Response(JSON.stringify({
      success: true,
      data: {
        query,
        results: results.map(({ protocol, chain, auditCount, latestAudit, firms }) => ({
          protocol, chain, auditCount, latestAudit, firms,
        })),
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

