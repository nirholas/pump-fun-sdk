export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const response = await fetch('https://api.llama.fi/v2/chains');
    const data = await response.json();
    
    // Sort by TVL and return top 20
    const sortedChains = data
      .sort((a: any, b: any) => (b.tvl || 0) - (a.tvl || 0))
      .slice(0, 20)
      .map((c: any) => ({
        name: c.name,
        tvl: c.tvl,
        tokenSymbol: c.tokenSymbol,
        chainId: c.chainId,
      }));

    return new Response(JSON.stringify(sortedChains), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch chains' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
