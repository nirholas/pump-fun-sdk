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
    const { chain } = body;

    const response = await fetch('https://yields.llama.fi/pools');
    const data = await response.json();
    
    let pools = data.data;
    
    // Filter by chain if specified
    if (chain) {
      pools = pools.filter((p: any) => 
        p.chain?.toLowerCase() === chain.toLowerCase()
      );
    }
    
    // Sort by APY and return top 20
    const topYields = pools
      .filter((p: any) => p.apy && p.tvlUsd > 100000)
      .sort((a: any, b: any) => (b.apy || 0) - (a.apy || 0))
      .slice(0, 20)
      .map((p: any) => ({
        project: p.project,
        symbol: p.symbol,
        chain: p.chain,
        apy: p.apy,
        tvlUsd: p.tvlUsd,
        apyBase: p.apyBase,
        apyReward: p.apyReward,
        stablecoin: p.stablecoin,
      }));

    return new Response(JSON.stringify(topYields), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch yields' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
