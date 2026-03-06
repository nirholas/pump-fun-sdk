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
    const { chainId = 1, fromToken, toToken, amount } = body;

    if (!fromToken || !toToken || !amount) {
      return new Response(JSON.stringify({ error: 'fromToken, toToken, and amount are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Note: 1inch API requires API key for production use
    // This is a simplified example
    return new Response(JSON.stringify({
      note: '1inch API requires API key. Visit https://portal.1inch.dev',
      chainId,
      fromToken,
      toToken,
      amount,
      estimatedGas: 'Requires API key',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to get quote' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
