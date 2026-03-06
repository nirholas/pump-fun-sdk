export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // The Graph Network stats from their GraphQL endpoint
    // Using public stats available from DeFiLlama as proxy
    const response = await fetch('https://api.llama.fi/protocol/the-graph');
    const data = await response.json();

    const getTvl = (tvlArray: any[]) => {
      if (!tvlArray || tvlArray.length === 0) return 0;
      return tvlArray.at(-1)?.totalLiquidityUSD || 0;
    };

    return new Response(JSON.stringify({
      name: data.name,
      symbol: data.symbol,
      description: 'Decentralized indexing protocol for querying blockchain data',
      totalStaked: getTvl(data.tvl),
      tvlChange24h: data.change_1d,
      tvlChange7d: data.change_7d,
      category: data.category,
      chains: data.chains,
      url: data.url,
      twitter: data.twitter,
      note: 'GRT is staked by Indexers, Curators, and Delegators to secure the network',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to fetch Graph network stats' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
