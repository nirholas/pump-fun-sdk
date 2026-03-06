export { SniperStrategy } from './sniper.js';
export { MomentumStrategy } from './momentum.js';
export { GraduationStrategy } from './graduation.js';
export { MarketMakerStrategy } from './market-maker.js';
export type { Strategy, TradeSignal, TokenSnapshot, StrategyConfig } from './types.js';

import type { Strategy } from './types.js';
import { SniperStrategy } from './sniper.js';
import { MomentumStrategy } from './momentum.js';
import { GraduationStrategy } from './graduation.js';
import { MarketMakerStrategy } from './market-maker.js';

/** Registry of built-in strategies by name */
export const STRATEGY_REGISTRY: Record<string, () => Strategy> = {
  sniper: () => new SniperStrategy(),
  momentum: () => new MomentumStrategy(),
  graduation: () => new GraduationStrategy(),
  'market-maker': () => new MarketMakerStrategy(),
};
