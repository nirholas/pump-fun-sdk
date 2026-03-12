/**
 * PumpFun Telegram Bot — Types
 */

export interface BotConfig {
    allowedUserIds: number[];
    enableFeeDistributionAlerts: boolean;
    enableGraduationAlerts: boolean;
    enableLaunchMonitor: boolean;
    enableTradeAlerts: boolean;
    githubOnlyFilter: boolean;
    ipfsGateway: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    pollIntervalSeconds: number;
    solanaRpcUrl: string;
    solanaRpcUrls: string[];
    solanaWsUrl: string | undefined;
    telegramToken: string;
    whaleThresholdSol: number;
}
