export const config = { runtime: 'edge' };

const SOLANA_RPC = typeof process !== 'undefined' && process.env?.SOLANA_RPC_URL
  ? process.env.SOLANA_RPC_URL
  : 'https://api.mainnet-beta.solana.com';

const ETH_RPC = 'https://eth.llamarpc.com';

const COMPUTE_UNITS_BY_TYPE: Record<string, number> = {
  transfer: 200,
  swap: 300000,
  'create-token': 400000,
  stake: 200000,
  'token-transfer': 50000,
  default: 200000,
};

const PRIORITY_LEVELS: Record<string, string> = {
  low: 'p25',
  medium: 'p50',
  high: 'p75',
  urgent: 'p99',
};

async function fetchSolanaFees(): Promise<{ low: number; medium: number; high: number; urgent: number }> {
  try {
    const response = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getRecentPrioritizationFees',
        params: [],
      }),
    });
    const json = await response.json();
    const fees: number[] = (json.result || [])
      .map((f: { prioritizationFee: number }) => f.prioritizationFee)
      .filter((f: number) => f > 0)
      .sort((a: number, b: number) => a - b);

    if (fees.length === 0) {
      return { low: 1000, medium: 50000, high: 1000000, urgent: 10000000 };
    }

    const percentile = (arr: number[], p: number) => arr[Math.floor(arr.length * p)] || arr[arr.length - 1];
    return {
      low: percentile(fees, 0.25),
      medium: percentile(fees, 0.50),
      high: percentile(fees, 0.75),
      urgent: percentile(fees, 0.99),
    };
  } catch {
    return { low: 1000, medium: 50000, high: 1000000, urgent: 10000000 };
  }
}

async function fetchSolPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112');
    const json = await response.json();
    return parseFloat(json.data?.['So11111111111111111111111111111111111111112']?.price || '150');
  } catch {
    return 150;
  }
}

async function fetchEthGas(): Promise<{ baseFee: number; priorityFee: number; gasPrice: number }> {
  try {
    const response = await fetch(ETH_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_gasPrice', params: [] }),
    });
    const json = await response.json();
    const gasPrice = parseInt(json.result, 16);
    return { baseFee: gasPrice, priorityFee: Math.floor(gasPrice * 0.1), gasPrice };
  } catch {
    return { baseFee: 30e9, priorityFee: 2e9, gasPrice: 32e9 };
  }
}

/**
 * Estimate gas for a transaction
 */
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const chain = (body.chain || 'solana').toLowerCase();
    const transactionType = body.transactionType || 'default';

    if (chain === 'solana') {
      const [fees, solPrice] = await Promise.all([fetchSolanaFees(), fetchSolPrice()]);
      const computeUnits = COMPUTE_UNITS_BY_TYPE[transactionType] || COMPUTE_UNITS_BY_TYPE.default;
      const baseFee = 0.000005; // 5000 lamports per signature

      const estimates: Record<string, { fee: number; unit: string; usd: number; priorityFee: number }> = {};
      for (const [level, _] of Object.entries(PRIORITY_LEVELS)) {
        const priorityFee = fees[level as keyof typeof fees];
        const totalLamports = 5000 + (priorityFee * computeUnits / 1e6);
        const feeSol = totalLamports / 1e9;
        estimates[level] = {
          fee: parseFloat(feeSol.toFixed(9)),
          unit: 'SOL',
          usd: parseFloat((feeSol * solPrice).toFixed(4)),
          priorityFee,
        };
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          chain: 'solana',
          estimates,
          baseFee,
          computeUnits,
          timestamp: new Date().toISOString(),
        },
      }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=10' },
      });
    }

    if (chain === 'ethereum') {
      const gas = await fetchEthGas();
      const gasLimit = transactionType === 'transfer' ? 21000 : 200000;
      const gasPriceGwei = gas.gasPrice / 1e9;

      const estimates = {
        low: { fee: parseFloat(((gasLimit * gas.gasPrice * 0.8) / 1e18).toFixed(6)), unit: 'ETH', gasPrice: parseFloat((gasPriceGwei * 0.8).toFixed(2)) },
        medium: { fee: parseFloat(((gasLimit * gas.gasPrice) / 1e18).toFixed(6)), unit: 'ETH', gasPrice: parseFloat(gasPriceGwei.toFixed(2)) },
        high: { fee: parseFloat(((gasLimit * gas.gasPrice * 1.2) / 1e18).toFixed(6)), unit: 'ETH', gasPrice: parseFloat((gasPriceGwei * 1.2).toFixed(2)) },
        urgent: { fee: parseFloat(((gasLimit * gas.gasPrice * 1.5) / 1e18).toFixed(6)), unit: 'ETH', gasPrice: parseFloat((gasPriceGwei * 1.5).toFixed(2)) },
      };

      return new Response(JSON.stringify({
        success: true,
        data: {
          chain: 'ethereum',
          estimates,
          gasLimit,
          timestamp: new Date().toISOString(),
        },
      }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=10' },
      });
    }

    return new Response(JSON.stringify({ error: `Unsupported chain: ${chain}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Server error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

