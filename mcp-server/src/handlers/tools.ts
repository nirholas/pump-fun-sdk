import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Connection } from "@solana/web3.js";
import { OnlinePumpSdk } from "@pump-fun/pump-sdk";
import type { ServerState } from "../types.js";
import { ALL_TOOLS } from "../tools/index.js";

// Wallet tools that work without an RPC connection
const WALLET_TOOLS = new Set([
  "generate_keypair",
  "generate_vanity_address",
  "validate_address",
  "estimate_vanity_time",
  "restore_keypair",
  "sign_message",
  "verify_signature",
]);

export function registerToolHandlers(
  server: Server,
  state: ServerState,
  getConnection: () => Connection,
): void {
  // Build tool name → definition lookup
  const toolMap = new Map(ALL_TOOLS.map((t) => [t.name, t]));

  // Lazy singleton SDK — created on first SDK tool call
  let sdk: OnlinePumpSdk | null = null;
  function getSdk(): OnlinePumpSdk {
    if (!sdk) {
      const connection = getConnection();
      sdk = new OnlinePumpSdk(connection);
    }
    return sdk;
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: ALL_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = toolMap.get(name);

    if (!tool) {
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      // Wallet tools pass a null-ish sdk (the walletToolHandler wrapper ignores it)
      // SDK tools get the lazy-initialized OnlinePumpSdk
      const sdkInstance = WALLET_TOOLS.has(name) ? (null as any) : getSdk();
      return await tool.handler(sdkInstance, args ?? {});
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error in ${name}: ${err instanceof Error ? err.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  });
}
