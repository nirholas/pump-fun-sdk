import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { MCP_VERSION } from './types/index.js';
import { registerToolHandlers } from './handlers/tools.js';
import { registerResourceHandlers } from './handlers/resources.js';
import { registerPromptHandlers } from './handlers/prompts.js';
export class SolanaWalletMCPServer {
    server;
    state;
    constructor() {
        this.state = {
            initialized: false,
            clientCapabilities: {},
            generatedKeypairs: new Map(),
        };
        this.server = new Server({
            name: 'solana-wallet-toolkit',
            version: '1.0.0',
        }, {
            capabilities: this.getCapabilities(),
        });
        this.registerHandlers();
        this.setupErrorHandling();
    }
    getCapabilities() {
        return {
            tools: {
                listChanged: true,
            },
            resources: {
                subscribe: false,
                listChanged: true,
            },
            prompts: {
                listChanged: true,
            },
        };
    }
    registerHandlers() {
        // Register all handlers with access to server state
        registerToolHandlers(this.server, this.state);
        registerResourceHandlers(this.server, this.state);
        registerPromptHandlers(this.server, this.state);
    }
    setupErrorHandling() {
        this.server.onerror = (error) => {
            console.error('[MCP Error]', error);
        };
        process.on('SIGINT', async () => {
            await this.shutdown();
            process.exit(0);
        });
        process.on('SIGTERM', async () => {
            await this.shutdown();
            process.exit(0);
        });
    }
    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        // Log to stderr (stdout is for MCP communication)
        console.error('Solana Wallet MCP Server started');
        console.error(`Protocol version: ${MCP_VERSION}`);
    }
    async shutdown() {
        // Zeroize any sensitive data
        for (const [, keypair] of this.state.generatedKeypairs) {
            keypair.secretKey.fill(0);
        }
        this.state.generatedKeypairs.clear();
        console.error('Solana Wallet MCP Server shutdown');
    }
    getState() {
        return this.state;
    }
}
// Factory function for testing
export function createServer() {
    return new SolanaWalletMCPServer();
}
//# sourceMappingURL=server.js.map