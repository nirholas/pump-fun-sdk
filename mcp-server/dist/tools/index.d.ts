/**
 * MCP Tool Implementations for Solana Wallet Toolkit
 *
 * SECURITY: Uses ONLY official @solana/web3.js for cryptographic operations.
 * SECURITY: Never logs private keys.
 */
import { ServerState, ToolResult } from '../types/index.js';
type CallToolResult = ToolResult;
/**
 * Handle a tool call request
 */
export declare function handleToolCall(name: string, args: Record<string, unknown>, state: ServerState): Promise<CallToolResult>;
export {};
//# sourceMappingURL=index.d.ts.map