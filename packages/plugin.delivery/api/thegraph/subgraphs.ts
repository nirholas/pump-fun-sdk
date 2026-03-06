export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { category } = body;

    // Popular subgraphs on The Graph
    const subgraphs = [
      { id: 'uniswap-v3', name: 'Uniswap V3', category: 'defi', network: 'ethereum' },
      { id: 'uniswap-v3-arbitrum', name: 'Uniswap V3 Arbitrum', category: 'defi', network: 'arbitrum' },
      { id: 'aave-v3', name: 'Aave V3', category: 'defi', network: 'ethereum' },
      { id: 'compound-v3', name: 'Compound V3', category: 'defi', network: 'ethereum' },
      { id: 'lido', name: 'Lido', category: 'defi', network: 'ethereum' },
      { id: 'ens', name: 'ENS Domains', category: 'dao', network: 'ethereum' },
      { id: 'opensea', name: 'OpenSea', category: 'nft', network: 'ethereum' },
      { id: 'sushiswap', name: 'SushiSwap', category: 'defi', network: 'ethereum' },
      { id: 'balancer-v2', name: 'Balancer V2', category: 'defi', network: 'ethereum' },
      { id: 'curve', name: 'Curve Finance', category: 'defi', network: 'ethereum' },
      { id: 'yearn', name: 'Yearn Finance', category: 'defi', network: 'ethereum' },
      { id: 'maker', name: 'MakerDAO', category: 'defi', network: 'ethereum' },
      { id: 'synthetix', name: 'Synthetix', category: 'defi', network: 'ethereum' },
      { id: 'decentraland', name: 'Decentraland', category: 'nft', network: 'ethereum' },
      { id: 'the-sandbox', name: 'The Sandbox', category: 'nft', network: 'ethereum' },
    ];

    let filtered = subgraphs;
    if (category) {
      filtered = subgraphs.filter(
        (s) => s.category.toLowerCase() === category.toLowerCase()
      );
    }

    return new Response(JSON.stringify({ 
      subgraphs: filtered,
      count: filtered.length,
      note: 'Query subgraphs via The Graph hosted service or decentralized network',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to fetch subgraphs' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
