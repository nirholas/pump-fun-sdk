/**
 * Resource implementations for MCP server
 * This file exports the handleReadResource function that routes to appropriate handlers
 */
import { ServerState, ResourceResult } from '../types/index.js';
/**
 * Handle a resource read request by parsing the URI and routing to the appropriate handler
 * @param uri - The URI of the resource to read (solana:// protocol)
 * @param state - The server state
 * @returns The resource content
 */
export declare function handleReadResource(uri: string, state: ServerState): Promise<ResourceResult>;
//# sourceMappingURL=index.d.ts.map