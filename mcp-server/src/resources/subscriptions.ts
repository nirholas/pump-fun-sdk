import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ServerState } from '../types/index.js';

/**
 * Resource subscription tracking
 * Maps resource URIs to sets of subscription IDs
 */
const subscriptions = new Map<string, Set<string>>();

/**
 * Register resource subscription handlers
 * Note: Resource subscriptions are optional in MCP
 * Implement if your use case requires real-time updates
 */
export function registerResourceSubscriptions(
  _server: Server,
  _state: ServerState
): void {
  // Subscribe to resource changes
  // server.setRequestHandler(SubscribeResourceSchema, async (request) => {
  //   const { uri } = request.params;
  //   const subscriptionId = generateSubscriptionId();
  //   
  //   if (!subscriptions.has(uri)) {
  //     subscriptions.set(uri, new Set());
  //   }
  //   subscriptions.get(uri)!.add(subscriptionId);
  //   
  //   return { subscriptionId };
  // });

  // Unsubscribe
  // server.setRequestHandler(UnsubscribeResourceSchema, async (request) => {
  //   const { subscriptionId, uri } = request.params;
  //   
  //   if (subscriptions.has(uri)) {
  //     subscriptions.get(uri)!.delete(subscriptionId);
  //   }
  //   
  //   return {};
  // });
}

/**
 * Notify subscribers when a resource changes
 * Sends a notification to all subscribed clients
 */
export function notifyResourceChanged(server: Server, uri: string): void {
  const subs = subscriptions.get(uri);
  
  if (subs && subs.size > 0) {
    // Send notification to subscribed clients
    // This would use server.notification() method
    try {
      server.notification({
        method: 'notifications/resources/updated',
        params: { uri },
      });
    } catch (error) {
      console.error(`Failed to notify resource change for ${uri}:`, error);
    }
  }
  
  // Log resource changes for debugging (to stderr)
  console.error(`Resource changed: ${uri}`);
}

/**
 * Notify when a new keypair is generated
 * Called by tool handlers when keypairs are created
 */
export function onKeypairGenerated(server: Server, keypairId: string): void {
  notifyResourceChanged(server, `solana://keypair/${keypairId}`);
  
  // Also notify that the config resource changed (keypairsInMemory updated)
  notifyResourceChanged(server, 'solana://config');
}

/**
 * Notify when a keypair is removed
 * Called when keypairs are cleared from memory
 */
export function onKeypairRemoved(server: Server, keypairId: string): void {
  const uri = `solana://keypair/${keypairId}`;
  
  // Remove subscriptions for this keypair
  subscriptions.delete(uri);
  
  // Notify that config changed
  notifyResourceChanged(server, 'solana://config');
}

/**
 * Clear all subscriptions
 * Called on server shutdown
 */
export function clearAllSubscriptions(): void {
  subscriptions.clear();
}

/**
 * Get subscription count for a resource
 * Useful for debugging and monitoring
 */
export function getSubscriptionCount(uri: string): number {
  return subscriptions.get(uri)?.size ?? 0;
}

/**
 * Get all active subscriptions
 * Returns a map of URIs to subscription counts
 */
export function getActiveSubscriptions(): Map<string, number> {
  const result = new Map<string, number>();
  for (const [uri, subs] of subscriptions) {
    result.set(uri, subs.size);
  }
  return result;
}
