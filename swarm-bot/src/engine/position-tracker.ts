import BN from 'bn.js';
import { PublicKey } from '@solana/web3.js';
import type { SwarmDb } from '../store/db.js';
import { logger } from '../logger.js';
import type { ExecuteResult } from './executor.js';

const LAMPORTS_PER_SOL = 1_000_000_000;

export interface PositionState {
  mint: string;
  tokenAmount: BN;
  entryAvgPrice: number;
  entrySol: BN;
  currentPrice: number;
  currentValueSol: BN;
  unrealizedPnlSol: number;
  realizedPnlSol: number;
}

/**
 * Tracks positions for a single bot. Records buys, sells, and
 * computes P&L in real-time. Persists to SQLite via SwarmDb.
 */
export class PositionTracker {
  private readonly db: SwarmDb;
  private readonly botId: string;

  constructor(db: SwarmDb, botId: string) {
    this.db = db;
    this.botId = botId;
  }

  /** Record a buy trade and update position */
  recordBuy(mint: string, result: ExecuteResult): void {
    if (!result.success || !result.signature) return;

    // Record the trade
    this.db.insertTrade({
      bot_id: this.botId,
      mint,
      side: 'buy',
      sol_amount: result.solAmount.toNumber() / LAMPORTS_PER_SOL,
      token_amount: result.tokenAmount.toNumber(),
      price: result.price,
      signature: result.signature,
      status: 'confirmed',
    });

    // Update or create position
    const existing = this.db.getPosition(this.botId, mint);
    if (existing) {
      const newTokenAmount = existing.token_amount + result.tokenAmount.toNumber();
      const newEntrySol = existing.entry_sol + result.solAmount.toNumber() / LAMPORTS_PER_SOL;
      const newAvgPrice = newEntrySol / newTokenAmount;

      this.db.updatePosition(this.botId, mint, {
        token_amount: newTokenAmount,
        entry_sol: newEntrySol,
        entry_price: newAvgPrice,
        current_price: result.price || newAvgPrice,
      });
    } else {
      this.db.insertPosition({
        bot_id: this.botId,
        mint,
        token_amount: result.tokenAmount.toNumber(),
        entry_sol: result.solAmount.toNumber() / LAMPORTS_PER_SOL,
        entry_price: result.price,
        current_price: result.price,
        unrealized_pnl_sol: 0,
        status: 'open',
      });
    }

    logger.info(`[${this.botId}] Position BUY ${mint.slice(0, 8)}… — ${result.tokenAmount.toString()} tokens @ ${result.price.toFixed(12)}`);
  }

  /** Record a sell trade and update position */
  recordSell(mint: string, result: ExecuteResult): void {
    if (!result.success || !result.signature) return;

    this.db.insertTrade({
      bot_id: this.botId,
      mint,
      side: 'sell',
      sol_amount: result.solAmount.toNumber() / LAMPORTS_PER_SOL,
      token_amount: result.tokenAmount.toNumber(),
      price: result.price,
      signature: result.signature,
      status: 'confirmed',
    });

    const existing = this.db.getPosition(this.botId, mint);
    if (!existing) {
      logger.warn(`[${this.botId}] Sell recorded but no open position for ${mint}`);
      return;
    }

    const remainingTokens = existing.token_amount - result.tokenAmount.toNumber();
    const solReceived = result.solAmount.toNumber() / LAMPORTS_PER_SOL;
    const proportionSold = result.tokenAmount.toNumber() / existing.token_amount;
    const costBasis = existing.entry_sol * proportionSold;
    const realizedPnl = solReceived - costBasis;

    if (remainingTokens <= 0) {
      // Position fully closed
      this.db.updatePosition(this.botId, mint, {
        token_amount: 0,
        current_price: result.price || 0,
        unrealized_pnl_sol: 0,
        status: 'closed',
      });
      logger.info(`[${this.botId}] Position CLOSED ${mint.slice(0, 8)}… — realized P&L: ${realizedPnl.toFixed(4)} SOL`);
    } else {
      // Partial sell
      const remainingEntrySol = existing.entry_sol * (1 - proportionSold);
      this.db.updatePosition(this.botId, mint, {
        token_amount: remainingTokens,
        entry_sol: remainingEntrySol,
        current_price: result.price || existing.current_price,
      });
      logger.info(`[${this.botId}] Position PARTIAL SELL ${mint.slice(0, 8)}… — ${remainingTokens} tokens remaining, realized: ${realizedPnl.toFixed(4)} SOL`);
    }
  }

  /** Update current prices for all open positions */
  updatePrice(mint: string, currentPrice: number): void {
    const pos = this.db.getPosition(this.botId, mint);
    if (!pos || pos.status !== 'open') return;

    const currentValueSol = pos.token_amount * currentPrice;
    const unrealizedPnl = currentValueSol - pos.entry_sol;

    this.db.updatePosition(this.botId, mint, {
      current_price: currentPrice,
      unrealized_pnl_sol: unrealizedPnl,
    });
  }

  /** Get all open positions for this bot */
  getOpenPositions(): PositionState[] {
    const positions = this.db.getPositionsByBot(this.botId);
    return positions
      .filter(p => p.status === 'open')
      .map(p => ({
        mint: p.mint,
        tokenAmount: new BN(p.token_amount),
        entryAvgPrice: p.entry_price,
        entrySol: new BN(Math.floor(p.entry_sol * LAMPORTS_PER_SOL)),
        currentPrice: p.current_price,
        currentValueSol: new BN(Math.floor(p.token_amount * p.current_price * LAMPORTS_PER_SOL)),
        unrealizedPnlSol: p.unrealized_pnl_sol,
        realizedPnlSol: 0,
      }));
  }

  /** Get position for a specific mint */
  getPosition(mint: string): PositionState | null {
    const p = this.db.getPosition(this.botId, mint);
    if (!p || p.status !== 'open') return null;
    return {
      mint: p.mint,
      tokenAmount: new BN(p.token_amount),
      entryAvgPrice: p.entry_price,
      entrySol: new BN(Math.floor(p.entry_sol * LAMPORTS_PER_SOL)),
      currentPrice: p.current_price,
      currentValueSol: new BN(Math.floor(p.token_amount * p.current_price * LAMPORTS_PER_SOL)),
      unrealizedPnlSol: p.unrealized_pnl_sol,
      realizedPnlSol: 0,
    };
  }

  /** Snapshot current P&L to database */
  snapshotPnl(): void {
    const positions = this.db.getPositionsByBot(this.botId);
    const open = positions.filter(p => p.status === 'open');
    const totalInvested = open.reduce((s, p) => s + p.entry_sol, 0);
    const totalUnrealized = open.reduce((s, p) => s + p.unrealized_pnl_sol, 0);

    // Count realized from closed positions recently
    const trades = this.db.getTradesByBot(this.botId, 100);
    const sellTrades = trades.filter(t => t.side === 'sell');
    const totalReturned = sellTrades.reduce((s, t) => s + t.sol_amount, 0);

    this.db.insertPnlSnapshot({
      bot_id: this.botId,
      total_invested_sol: totalInvested,
      total_returned_sol: totalReturned,
      unrealized_pnl_sol: totalUnrealized,
      realized_pnl_sol: totalReturned - totalInvested * 0.5, // Rough estimate
      open_positions: open.length,
    });
  }
}
