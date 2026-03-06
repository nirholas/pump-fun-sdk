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

    const response = await fetch(
      'https://api.dexscreener.com/token-profiles/latest/v1',
      { headers: { 'Accept': 'application/json' } }
    );
    const data = await response.json();

    let tokens = data || [];
    if (chain) {
      tokens = tokens.filter((t: any) => t.chainId === chain);
    }

    const listings = tokens.slice(0, 20).map((t: any) => ({
      chain: t.chainId,
      tokenAddress: t.tokenAddress,
      name: t.name,
      symbol: t.symbol,
      url: t.url,
      description: t.description,
    }));

    return new Response(JSON.stringify({ chain: chain || 'all', listings }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch new listings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
