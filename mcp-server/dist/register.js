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
import { TOOLS } from "./handlers/tools.js";
import { handleToolCall } from "./tools/index.js";
/**
 * Register all Pump SDK MCP tools with a McpServer instance.
 *
 * Creates an isolated ServerState so generated keypairs are scoped to
 * the Pump tool set.  If you need to share state (e.g. keypairs) across
 * multiple tool sets, pass your own `state` object.
 */
export function registerPump(server, sharedState) {
    const state = sharedState ?? {
        initialized: true,
        clientCapabilities: {},
        generatedKeypairs: new Map(),
    };
    for (const tool of TOOLS) {
        server.tool(tool.name, tool.description, 
        // McpServer.tool() accepts raw JSON Schema objects as the schema arg
        tool.inputSchema, async (params) => {
            try {
                // Pre-process shareholders JSON string for fee sharing
                if (tool.name === "build_update_fee_shares" &&
                    typeof params.shareholders === "string") {
                    try {
                        params.shareholders = JSON.parse(params.shareholders);
                    }
                    catch {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: 'Invalid shareholders JSON. Expected: [{"address": "pubkey", "shareBps": 5000}, ...]',
                                },
                            ],
                            isError: true,
                        };
                    }
                }
                const result = await handleToolCall(tool.name, params, state);
                return result;
            }
            catch (error) {
                const msg = error instanceof Error ? error.message : "Unknown error";
                return {
                    content: [{ type: "text", text: `Error: ${msg}` }],
                    isError: true,
                };
            }
        });
    }
}
/** Re-export TOOLS array for introspection */
export { TOOLS } from "./handlers/tools.js";
//# sourceMappingURL=register.js.map