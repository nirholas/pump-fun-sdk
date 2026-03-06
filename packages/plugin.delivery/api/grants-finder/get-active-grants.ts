export const config = { runtime: 'edge' };

interface Grant {
  name: string;
  organization: string;
  chain: string;
  category: string;
  amount: { min: number; max: number; currency: string };
  deadline: string;
  status: string;
  url: string;
  description: string;
}

const GRANTS_REGISTRY: Grant[] = [
  { name: 'Solana Foundation Developer Grant', organization: 'Solana Foundation', chain: 'solana', category: 'developer-tooling', amount: { min: 5000, max: 250000, currency: 'USD' }, deadline: '2026-06-30', status: 'open', url: 'https://solana.org/grants', description: 'Grants for developer tools, SDKs, and infrastructure on Solana' },
  { name: 'Superteam Bounties', organization: 'Superteam', chain: 'solana', category: 'ecosystem', amount: { min: 500, max: 50000, currency: 'USD' }, deadline: '2026-12-31', status: 'open', url: 'https://superteam.fun', description: 'Community bounties for Solana ecosystem tasks and contributions' },
  { name: 'Solana DeFi Grant', organization: 'Solana Foundation', chain: 'solana', category: 'defi', amount: { min: 10000, max: 500000, currency: 'USD' }, deadline: '2026-09-30', status: 'open', url: 'https://solana.org/grants', description: 'Grants for DeFi protocols, liquidity solutions, and financial primitives' },
  { name: 'Gitcoin Grants Round', organization: 'Gitcoin', chain: 'ethereum', category: 'public-goods', amount: { min: 100, max: 100000, currency: 'USD' }, deadline: '2026-06-15', status: 'open', url: 'https://grants.gitcoin.co', description: 'Quadratic funding for open source public goods across web3' },
  { name: 'Ethereum Foundation Academic Grant', organization: 'Ethereum Foundation', chain: 'ethereum', category: 'research', amount: { min: 5000, max: 300000, currency: 'USD' }, deadline: '2026-08-01', status: 'open', url: 'https://ethereum.org/en/community/grants', description: 'Research grants for Ethereum protocol improvements, cryptography, and formal verification' },
  { name: 'Ethereum Foundation Ecosystem Support', organization: 'Ethereum Foundation', chain: 'ethereum', category: 'infrastructure', amount: { min: 10000, max: 500000, currency: 'USD' }, deadline: '2026-12-31', status: 'open', url: 'https://esp.ethereum.foundation', description: 'Support for client teams, L2 research, and infrastructure projects' },
  { name: 'Optimism RPGF', organization: 'Optimism Collective', chain: 'optimism', category: 'public-goods', amount: { min: 1000, max: 500000, currency: 'OP' }, deadline: '2026-07-31', status: 'open', url: 'https://app.optimism.io/retropgf', description: 'Retroactive public goods funding for impactful Optimism ecosystem contributions' },
  { name: 'Arbitrum DAO Grants', organization: 'Arbitrum DAO', chain: 'arbitrum', category: 'ecosystem', amount: { min: 5000, max: 250000, currency: 'ARB' }, deadline: '2026-09-30', status: 'open', url: 'https://arbitrum.foundation/grants', description: 'Ecosystem grants for DeFi, gaming, social, and infrastructure on Arbitrum' },
  { name: 'Uniswap Grants Program', organization: 'Uniswap Foundation', chain: 'ethereum', category: 'defi', amount: { min: 5000, max: 150000, currency: 'USD' }, deadline: '2026-06-30', status: 'open', url: 'https://www.uniswapfoundation.org/grants', description: 'Grants for DeFi innovation, governance tooling, and Uniswap ecosystem growth' },
  { name: 'Chainlink BUILD Program', organization: 'Chainlink', chain: 'ethereum', category: 'infrastructure', amount: { min: 10000, max: 200000, currency: 'LINK' }, deadline: '2026-12-31', status: 'open', url: 'https://chain.link/economics/build', description: 'Accelerate growth with enhanced Chainlink services and technical support' },
  { name: 'Polygon Village Grants', organization: 'Polygon Labs', chain: 'polygon', category: 'ecosystem', amount: { min: 5000, max: 100000, currency: 'USD' }, deadline: '2026-08-31', status: 'open', url: 'https://polygon.technology/village/grants', description: 'Grants for building on Polygon PoS and zkEVM' },
  { name: 'Avalanche Multiverse Fund', organization: 'Avalanche Foundation', chain: 'avalanche', category: 'ecosystem', amount: { min: 10000, max: 500000, currency: 'AVAX' }, deadline: '2026-12-31', status: 'open', url: 'https://www.avax.network/ecosystem-grants', description: 'Incentive programs for subnets, DeFi, gaming, and enterprise applications' },
  { name: 'Near Protocol Grants', organization: 'Near Foundation', chain: 'near', category: 'developer-tooling', amount: { min: 5000, max: 200000, currency: 'USD' }, deadline: '2026-10-31', status: 'open', url: 'https://near.org/grants', description: 'Funding for developer tools, infrastructure, and ecosystem growth on Near' },
  { name: 'Cosmos Grants Program', organization: 'Interchain Foundation', chain: 'cosmos', category: 'infrastructure', amount: { min: 10000, max: 300000, currency: 'USD' }, deadline: '2026-12-31', status: 'open', url: 'https://interchain.io/funding', description: 'Grants for IBC, SDK modules, and cross-chain infrastructure' },
  { name: 'Sui Developer Grant', organization: 'Sui Foundation', chain: 'sui', category: 'developer-tooling', amount: { min: 5000, max: 150000, currency: 'USD' }, deadline: '2026-09-30', status: 'open', url: 'https://sui.io/grants', description: 'Grants for developer tools, Move smart contracts, and Sui ecosystem' },
  { name: 'Base Ecosystem Fund', organization: 'Base (Coinbase)', chain: 'base', category: 'ecosystem', amount: { min: 10000, max: 250000, currency: 'USD' }, deadline: '2026-12-31', status: 'open', url: 'https://base.org/grants', description: 'Grants for building consumer-friendly onchain applications on Base' },
];

/**
 * Get list of active grant programs
 */
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    const { chain, category, limit } = body;
    const maxLimit = Math.min(typeof limit === 'number' ? limit : 50, 50);

    let filtered = GRANTS_REGISTRY.filter(g => {
      const matchesChain = !chain || g.chain.toLowerCase() === chain.toLowerCase();
      const matchesCategory = !category || g.category.toLowerCase() === category.toLowerCase();
      return matchesChain && matchesCategory && g.status === 'open';
    });

    // Sort by deadline (soonest first), then by max amount (highest first)
    filtered.sort((a, b) => {
      const dateDiff = a.deadline.localeCompare(b.deadline);
      if (dateDiff !== 0) return dateDiff;
      return b.amount.max - a.amount.max;
    });

    filtered = filtered.slice(0, maxLimit);

    const rows = filtered.map(g =>
      `| ${g.name} | ${g.organization} | ${g.chain} | $${g.amount.min.toLocaleString()}-$${g.amount.max.toLocaleString()} ${g.amount.currency} | ${g.deadline} | [Apply](${g.url}) |`
    ).join('\n');

    const markdown = `## Active Grant Programs

| Name | Organization | Chain | Amount | Deadline | Link |
|------|-------------|-------|--------|----------|------|
${rows}

**Total:** ${filtered.length} grants found${chain ? ` (chain: ${chain})` : ''}${category ? ` (category: ${category})` : ''}
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

