/**
 * Prompt implementations - Agent 2 will implement these
 * This file exports the handleGetPrompt function that returns prompt content
 */
import { ServerState, PromptResult } from '../types/index.js';
/**
 * Handle a get prompt request
 * @param name - The name of the prompt
 * @param args - The arguments passed to the prompt
 * @param state - The server state
 * @returns The prompt result with messages
 */
export declare function handleGetPrompt(name: string, args: Record<string, unknown>, state: ServerState): Promise<PromptResult>;
//# sourceMappingURL=index.d.ts.map
