#!/usr/bin/env node
import { SolanaWalletMCPServer } from './server.js';
async function main() {
    const server = new SolanaWalletMCPServer();
    try {
        await server.start();
    }
    catch (error) {
        console.error('Failed to start MCP server:', error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=index.js.map