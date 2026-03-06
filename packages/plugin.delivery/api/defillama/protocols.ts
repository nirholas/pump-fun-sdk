export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const response = await fetch('https://api.llama.fi/protocols');
    const data = await response.json();
    
    // Return top 20 protocols by TVL for manageable response
    const topProtocols = data.slice(0, 20).map((p: any) => ({
      name: p.name,
      tvl: p.tvl,
      chain: p.chain,
      category: p.category,
      change_1d: p.change_1d,
      change_7d: p.change_7d,
    }));

    return new Response(JSON.stringify(topProtocols), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch protocols' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
