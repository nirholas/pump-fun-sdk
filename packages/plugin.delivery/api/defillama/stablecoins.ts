export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const response = await fetch('https://stablecoins.llama.fi/stablecoins?includePrices=true');
    const data = await response.json();
    
    // Return top 15 stablecoins by market cap
    const topStables = data.peggedAssets
      .slice(0, 15)
      .map((s: any) => ({
        name: s.name,
        symbol: s.symbol,
        pegType: s.pegType,
        pegMechanism: s.pegMechanism,
        circulating: s.circulating?.peggedUSD,
        chains: s.chains?.slice(0, 5),
      }));

    return new Response(JSON.stringify(topStables), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch stablecoins' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
