/**
 * registerPump — Bridge for McpServer (high-level API)
 *
 * Allows any project using @modelcontextprotocol/sdk McpServer to register
 * all Pump SDK tools with a single call:
 *
 *   import { registerPump } from "@nirholas/pump-fun-sdk"
 *   registerPump(server)
 *
 * This adapts the low-level TOOLS[] + handleToolCall() to the high-level
 * server.tool(name, description, schema, handler) pattern used by McpServer.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerState } from "./types/index.js";
/**
 * Register all Pump SDK MCP tools with a McpServer instance.
 *
 * Creates an isolated ServerState so generated keypairs are scoped to
 * the Pump tool set.  If you need to share state (e.g. keypairs) across
 * multiple tool sets, pass your own `state` object.
 */
export declare function registerPump(server: McpServer, sharedState?: ServerState): void;
/** Re-export TOOLS array for introspection */
export { TOOLS } from "./handlers/tools.js";
//# sourceMappingURL=register.d.ts.map