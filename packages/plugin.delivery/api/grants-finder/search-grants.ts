export const config = { runtime: 'edge' };

const GRANTS_REGISTRY = [
  { name: 'Solana Foundation Developer Grant', organization: 'Solana Foundation', chain: 'solana', category: 'developer-tooling', amount: '$5K-$250K', deadline: '2026-06-30', description: 'Grants for developer tools, SDKs, and infrastructure on Solana' },
  { name: 'Superteam Bounties', organization: 'Superteam', chain: 'solana', category: 'ecosystem', amount: '$500-$50K', deadline: '2026-12-31', description: 'Community bounties for Solana ecosystem tasks' },
  { name: 'Solana DeFi Grant', organization: 'Solana Foundation', chain: 'solana', category: 'defi', amount: '$10K-$500K', deadline: '2026-09-30', description: 'Grants for DeFi protocols and financial primitives' },
  { name: 'Gitcoin Grants Round', organization: 'Gitcoin', chain: 'ethereum', category: 'public-goods', amount: '$100-$100K', deadline: '2026-06-15', description: 'Quadratic funding for open source public goods' },
  { name: 'Ethereum Foundation Academic Grant', organization: 'Ethereum Foundation', chain: 'ethereum', category: 'research', amount: '$5K-$300K', deadline: '2026-08-01', description: 'Research grants for protocol improvements and cryptography' },
  { name: 'Ethereum Foundation Ecosystem Support', organization: 'Ethereum Foundation', chain: 'ethereum', category: 'infrastructure', amount: '$10K-$500K', deadline: '2026-12-31', description: 'Support for client teams, L2 research, and infrastructure' },
  { name: 'Optimism RPGF', organization: 'Optimism Collective', chain: 'optimism', category: 'public-goods', amount: '$1K-$500K OP', deadline: '2026-07-31', description: 'Retroactive public goods funding' },
  { name: 'Arbitrum DAO Grants', organization: 'Arbitrum DAO', chain: 'arbitrum', category: 'ecosystem', amount: '$5K-$250K ARB', deadline: '2026-09-30', description: 'Ecosystem grants for DeFi, gaming, and infrastructure' },
  { name: 'Uniswap Grants Program', organization: 'Uniswap Foundation', chain: 'ethereum', category: 'defi', amount: '$5K-$150K', deadline: '2026-06-30', description: 'DeFi innovation and governance tooling grants' },
  { name: 'Chainlink BUILD Program', organization: 'Chainlink', chain: 'ethereum', category: 'infrastructure', amount: '$10K-$200K LINK', deadline: '2026-12-31', description: 'Enhanced Chainlink services and technical support' },
  { name: 'Polygon Village Grants', organization: 'Polygon Labs', chain: 'polygon', category: 'ecosystem', amount: '$5K-$100K', deadline: '2026-08-31', description: 'Building on Polygon PoS and zkEVM' },
  { name: 'Avalanche Multiverse Fund', organization: 'Avalanche Foundation', chain: 'avalanche', category: 'ecosystem', amount: '$10K-$500K AVAX', deadline: '2026-12-31', description: 'Subnets, DeFi, gaming, and enterprise applications' },
  { name: 'Near Protocol Grants', organization: 'Near Foundation', chain: 'near', category: 'developer-tooling', amount: '$5K-$200K', deadline: '2026-10-31', description: 'Developer tools, infrastructure, and ecosystem growth' },
  { name: 'Cosmos Grants Program', organization: 'Interchain Foundation', chain: 'cosmos', category: 'infrastructure', amount: '$10K-$300K', deadline: '2026-12-31', description: 'IBC, SDK modules, and cross-chain infrastructure' },
  { name: 'Sui Developer Grant', organization: 'Sui Foundation', chain: 'sui', category: 'developer-tooling', amount: '$5K-$150K', deadline: '2026-09-30', description: 'Developer tools, Move contracts, and Sui ecosystem' },
  { name: 'Base Ecosystem Fund', organization: 'Base (Coinbase)', chain: 'base', category: 'ecosystem', amount: '$10K-$250K', deadline: '2026-12-31', description: 'Consumer-friendly onchain applications on Base' },
];

function scoreMatch(grant: typeof GRANTS_REGISTRY[0], q: string): number {
  const lower = q.toLowerCase();
  let score = 0;
  if (grant.name.toLowerCase().includes(lower)) score += 3;
  if (grant.organization.toLowerCase().includes(lower)) score += 2;
  if (grant.chain.toLowerCase().includes(lower)) score += 2;
  if (grant.category.toLowerCase().includes(lower)) score += 1;
  if (grant.description.toLowerCase().includes(lower)) score += 1;
  return score;
}

/**
 * Search grants by keyword
 */
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    const { query, chain } = body;

    if (!query || typeof query !== 'string') {
      return new Response(`## Error\n\nMissing required field: query`, {
        status: 400,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const scored = GRANTS_REGISTRY
      .map(g => ({ ...g, relevance: scoreMatch(g, query) }))
      .filter(g => {
        const matchesChain = !chain || g.chain.toLowerCase() === chain.toLowerCase();
        return g.relevance > 0 && matchesChain;
      })
      .sort((a, b) => b.relevance - a.relevance);

    const rows = scored.map(g =>
      `| ${g.name} | ${g.chain} | ${g.amount} | ${g.deadline} | ${(g.relevance / 3).toFixed(2)} |`
    ).join('\n');

    const markdown = `## Grant Search Results for "${query}"

| Name | Chain | Amount | Deadline | Relevance |
|------|-------|--------|----------|-----------|
${rows || '| No matching grants found | | | | |'}

**${scored.length} results found**
`;

    return new Response(markdown, {
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    return new Response(`## Error\n\n${error instanceof Error ? error.message : 'Unknown error'}`, {
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

