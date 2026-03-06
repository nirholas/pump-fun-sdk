export const config = { runtime: 'edge' };

/**
 * Pump.fun Fee Tiers (from SDK fees.ts)
 *
 * Tier 1: 0–0.1 SOL    → 200 BPS (2.0%)
 * Tier 2: 0.1–0.5 SOL  → 150 BPS (1.5%)
 * Tier 3: 0.5–5 SOL    → 100 BPS (1.0%)
 * Tier 4: 5–50 SOL     →  50 BPS (0.5%)
 * Tier 5: 50+ SOL      →  25 BPS (0.25%)
 */

interface FeeTier {
  tier: number;
  minSol: number;
  maxSol: number | null;
  bps: number;
  percentage: string;
  label: string;
}

const FEE_TIERS: FeeTier[] = [
  { tier: 1, minSol: 0, maxSol: 0.1, bps: 200, percentage: '2.00%', label: 'Micro' },
  { tier: 2, minSol: 0.1, maxSol: 0.5, bps: 150, percentage: '1.50%', label: 'Small' },
  { tier: 3, minSol: 0.5, maxSol: 5, bps: 100, percentage: '1.00%', label: 'Medium' },
  { tier: 4, minSol: 5, maxSol: 50, bps: 50, percentage: '0.50%', label: 'Large' },
  { tier: 5, minSol: 50, maxSol: null, bps: 25, percentage: '0.25%', label: 'Whale' },
];

function getFeeTier(solAmount: number): FeeTier {
  for (const tier of FEE_TIERS) {
    if (tier.maxSol === null || solAmount < tier.maxSol) {
      return tier;
    }
  }
  return FEE_TIERS[FEE_TIERS.length - 1];
}

function calculateFee(solAmount: number, bps: number): number {
  return solAmount * (bps / 10_000);
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { solAmount } = body;

    if (solAmount === undefined || solAmount === null) {
      return new Response(JSON.stringify({ error: 'solAmount is required (e.g., "1.5")' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const amount = parseFloat(solAmount);
    if (isNaN(amount) || amount < 0) {
      return new Response(JSON.stringify({ error: 'solAmount must be a non-negative number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const tier = getFeeTier(amount);
    const fee = calculateFee(amount, tier.bps);
    const amountAfterFee = amount - fee;

    return new Response(JSON.stringify({
      solAmount: amount.toFixed(9),
      feeTier: tier.tier,
      feeTierLabel: tier.label,
      feeBps: tier.bps,
      feePercentage: tier.percentage,
      feeAmountSol: fee.toFixed(9),
      feeAmountLamports: Math.round(fee * 1e9).toString(),
      amountAfterFeeSol: amountAfterFee.toFixed(9),
      tierRange: tier.maxSol
        ? `${tier.minSol}–${tier.maxSol} SOL`
        : `${tier.minSol}+ SOL`,
      allTiers: FEE_TIERS.map((t) => ({
        tier: t.tier,
        label: t.label,
        range: t.maxSol ? `${t.minSol}–${t.maxSol} SOL` : `${t.minSol}+ SOL`,
        bps: t.bps,
        percentage: t.percentage,
      })),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to calculate fee tier' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
