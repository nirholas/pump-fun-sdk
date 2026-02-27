/**
 * Pump Protocol MCP Tool Implementations
 *
 * Provides the full Pump SDK surface as MCP tools:
 *   - Token creation, buying, selling
 *   - Bonding curve price quoting
 *   - Fee calculation and sharing
 *   - Token incentives / volume rewards
 *   - On-chain state reading
 *   - PDA derivation
 *   - Migration
 *
 * SECURITY: Uses only official @solana/web3.js and @pump-fun/pump-sdk.
 */
import type { ServerState, ToolResult } from "../types/index.js";
export declare function handlePumpToolCall(name: string, args: Record<string, unknown>, state: ServerState): Promise<ToolResult>;
//# sourceMappingURL=pump.d.ts.map