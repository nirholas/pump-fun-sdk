import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ServerState } from '../types/index.js';
/**
 * Register resource subscription handlers
 * Note: Resource subscriptions are optional in MCP
 * Implement if your use case requires real-time updates
 */
export declare function registerResourceSubscriptions(_server: Server, _state: ServerState): void;
/**
 * Notify subscribers when a resource changes
 * Sends a notification to all subscribed clients
 */
export declare function notifyResourceChanged(server: Server, uri: string): void;
/**
 * Notify when a new keypair is generated
 * Called by tool handlers when keypairs are created
 */
export declare function onKeypairGenerated(server: Server, keypairId: string): void;
/**
 * Notify when a keypair is removed
 * Called when keypairs are cleared from memory
 */
export declare function onKeypairRemoved(server: Server, keypairId: string): void;
/**
 * Clear all subscriptions
 * Called on server shutdown
 */
export declare function clearAllSubscriptions(): void;
/**
 * Get subscription count for a resource
 * Useful for debugging and monitoring
 */
export declare function getSubscriptionCount(uri: string): number;
/**
 * Get all active subscriptions
 * Returns a map of URIs to subscription counts
 */
export declare function getActiveSubscriptions(): Map<string, number>;
//# sourceMappingURL=subscriptions.d.ts.map