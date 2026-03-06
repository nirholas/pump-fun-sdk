import BN from 'bn.js';
import type { Strategy, TokenSnapshot, StrategyConfig, TradeSignal } from './types.js';

const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Market-Maker Strategy
 *
 * Places grid-style buy and sell orders along the bonding curve to
 * capture the bid-ask spread. Keeps inventory balanced and profits
 * from two-sided flow.
 *
 * This is NOT a traditional CLOB market-maker — the bonding curve IS
 * the AMM. We simulate market-making by buying dips and selling rips
 * relative to a reference price, rebalancing around a target position.
 *
 * Params:
 *   targetPositionSol: number   — Target position size (default 1)
 *   gridSpreadPct: number       — % spread between buy/sell levels (default 5)
 *   rebalanceThresholdPct: number — Rebalance when position deviates by this % (default 30)
 *   minMcapSol: number          — Only MM tokens above this mcap (default 10)
 *   maxMcapSol: number          — Only MM tokens below this mcap (default 200)
 *   maxInventoryDeviationPct: number — Max deviation from target before forcing rebalance (default 60)
 */
export class MarketMakerStrategy implements Strategy {
  readonly name = 'market-maker';
  readonly description = 'Grid-style buy/sell around bonding curve midpoint for spread capture';

  // Reference price per mint (set on first evaluation)
  private refPrices = new Map<string, number>();
  // Last action timestamps to throttle
  private lastAction = new Map<string, number>();

  shouldTrack(snapshot: TokenSnapshot, config: StrategyConfig): boolean {
    const minMcap = (config.params.minMcapSol as number) ?? 10;
    const maxMcap = (config.params.maxMcapSol as number) ?? 200;
    const mcapSol = snapshot.marketCapLamports.toNumber() / LAMPORTS_PER_SOL;
    // Only market-make active bonding curve tokens
    return mcapSol >= minMcap && mcapSol <= maxMcap && !snapshot.complete;
  }

  evaluate(snapshot: TokenSnapshot, openPositionSol: BN | null, config: StrategyConfig): TradeSignal {
    const targetSol = (config.params.targetPositionSol as number) ?? 1;
    const gridPct = (config.params.gridSpreadPct as number) ?? 5;
    const rebalPct = (config.params.rebalanceThresholdPct as number) ?? 30;
    const maxDevPct = (config.params.maxInventoryDeviationPct as number) ?? 60;
    const key = snapshot.mint;
    const now = Date.now();
    const mcapSol = snapshot.marketCapLamports.toNumber() / LAMPORTS_PER_SOL;
    const currentPrice = snapshot.pricePerToken.toNumber() / LAMPORTS_PER_SOL;

    // Exit on graduation
    if (snapshot.complete) {
      this.cleanup(key);
      if (openPositionSol && openPositionSol.gtn(0)) {
        return { action: 'sell', mint: key, reason: 'Graduated — closing MM position', urgency: 85 };
      }
      return { action: 'hold', mint: key, reason: 'Graduated', urgency: 0 };
    }

    // Throttle — don't act more than once per 5 seconds
    const lastAct = this.lastAction.get(key) ?? 0;
    if (now - lastAct < 5000) {
      return { action: 'hold', mint: key, reason: 'Throttled — recent action', urgency: 0 };
    }

    const positionSol = openPositionSol ? openPositionSol.toNumber() / LAMPORTS_PER_SOL : 0;

    // Set or update reference price (EMA-style to adapt)
    if (!this.refPrices.has(key)) {
      this.refPrices.set(key, currentPrice);
    }
    const refPrice = this.refPrices.get(key)!;
    // Slowly adapt reference price (0.1 alpha EMA)
    const newRef = refPrice * 0.9 + currentPrice * 0.1;
    this.refPrices.set(key, newRef);

    const priceDeltaPct = ((currentPrice - newRef) / newRef) * 100;
    const positionDeltaPct = targetSol > 0 ? ((positionSol - targetSol) / targetSol) * 100 : 0;

    // Inventory too high — need to sell
    if (positionDeltaPct > maxDevPct) {
      const sellSol = (positionSol - targetSol) * 0.5; // Sell half the excess
      this.lastAction.set(key, now);
      return {
        action: 'sell',
        mint: key,
        reason: `Inventory +${positionDeltaPct.toFixed(0)}% over target — rebalancing`,
        urgency: 65,
      };
    }

    // Inventory too low — need to buy
    if (positionDeltaPct < -maxDevPct) {
      const buySol = Math.min(config.maxBuySol, (targetSol - positionSol) * 0.5);
      this.lastAction.set(key, now);
      return {
        action: 'buy',
        mint: key,
        reason: `Inventory ${positionDeltaPct.toFixed(0)}% under target — rebalancing`,
        solAmount: new BN(Math.floor(buySol * LAMPORTS_PER_SOL)),
        urgency: 60,
      };
    }

    // Grid: price below reference by gridPct → buy
    if (priceDeltaPct <= -gridPct && positionSol < targetSol * (1 + rebalPct / 100)) {
      const buySol = Math.min(config.maxBuySol, targetSol * 0.2);
      this.lastAction.set(key, now);
      return {
        action: 'buy',
        mint: key,
        reason: `Price ${priceDeltaPct.toFixed(1)}% below ref — grid buy`,
        solAmount: new BN(Math.floor(buySol * LAMPORTS_PER_SOL)),
        urgency: 50,
      };
    }

    // Grid: price above reference by gridPct → sell
    if (priceDeltaPct >= gridPct && positionSol > targetSol * (1 - rebalPct / 100)) {
      this.lastAction.set(key, now);
      return {
        action: 'sell',
        mint: key,
        reason: `Price +${priceDeltaPct.toFixed(1)}% above ref — grid sell`,
        urgency: 50,
      };
    }

    // Initial position building
    if (positionSol < targetSol * 0.5) {
      const buySol = Math.min(config.maxBuySol, (targetSol - positionSol) * 0.3);
      this.lastAction.set(key, now);
      return {
        action: 'buy',
        mint: key,
        reason: `Building initial position (${positionSol.toFixed(2)}/${targetSol.toFixed(2)} SOL)`,
        solAmount: new BN(Math.floor(buySol * LAMPORTS_PER_SOL)),
        urgency: 40,
      };
    }

    return { action: 'hold', mint: key, reason: `Grid neutral (Δp ${priceDeltaPct.toFixed(1)}%, inv ${positionDeltaPct.toFixed(0)}%)`, urgency: 0 };
  }

  private cleanup(key: string): void {
    this.refPrices.delete(key);
    this.lastAction.delete(key);
  }

  /** Exposed for testing */
  reset(): void {
    this.refPrices.clear();
    this.lastAction.clear();
  }
}
