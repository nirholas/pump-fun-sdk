/**
 * @pumpkit/core — Formatter Barrel Export
 */

export {
    link,
    solscanTx,
    solscanAccount,
    pumpFunToken,
    dexScreenerToken,
    bold,
    code,
    italic,
    shortenAddress,
    formatSol,
    formatNumber,
} from './links.js';

export {
    formatClaim,
    formatLaunch,
    formatGraduation,
    formatWhaleTrade,
    formatCTO,
    formatFeeDistribution,
} from './templates.js';

export type {
    ClaimEventData,
    LaunchEventData,
    GraduationEventData,
    WhaleTradeEventData,
    CTOEventData,
    FeeDistEventData,
} from './templates.js';
