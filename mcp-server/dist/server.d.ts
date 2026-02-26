import { ServerState } from './types/index.js';
export declare class SolanaWalletMCPServer {
    private server;
    private state;
    constructor();
    private getCapabilities;
    private registerHandlers;
    private setupErrorHandling;
    start(): Promise<void>;
    shutdown(): Promise<void>;
    getState(): ServerState;
}
export declare function createServer(): SolanaWalletMCPServer;
//# sourceMappingURL=server.d.ts.map
