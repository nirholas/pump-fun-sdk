import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ServerState } from '../types/index.js';
/**
 * Register sampling handlers
 * Sampling allows the MCP server to request LLM completions from the client
 * This is useful for complex workflows that require AI reasoning
 */
export declare function registerSamplingHandlers(server: Server, _state: ServerState): void;
/**
 * Helper function for server-initiated sampling
 * Requests an LLM completion from the MCP client
 *
 * @param server - The MCP server instance
 * @param prompt - The prompt to send to the LLM
 * @param systemPrompt - Optional system prompt for context
 * @param maxTokens - Maximum tokens in response (default: 1024)
 * @returns The LLM response text, or null if sampling failed
 */
export declare function requestSampling(server: Server, prompt: string, systemPrompt?: string, maxTokens?: number): Promise<string | null>;
/**
 * Request security analysis sampling
 * Specialized sampling for security-related questions
 */
export declare function requestSecurityAnalysis(server: Server, context: string): Promise<string | null>;
/**
 * Request wallet operation guidance
 * Specialized sampling for wallet operation questions
 */
export declare function requestWalletGuidance(server: Server, question: string): Promise<string | null>;
//# sourceMappingURL=sampling.d.ts.map
