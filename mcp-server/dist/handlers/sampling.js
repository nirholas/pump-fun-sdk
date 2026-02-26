/**
 * Register sampling handlers
 * Sampling allows the MCP server to request LLM completions from the client
 * This is useful for complex workflows that require AI reasoning
 */
export function registerSamplingHandlers(server, _state) {
    // The MCP server can request sampling from the client
    // This is done by calling server.request() with the sampling method
    // Note: Server-initiated sampling requires the client to support
    // the sampling capability. Claude Desktop supports this.
    // Example use cases:
    // 1. Complex security analysis that requires reasoning
    // 2. Multi-step wallet creation workflows
    // 3. Intelligent error diagnosis
}
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
export async function requestSampling(server, prompt, systemPrompt, maxTokens = 1024) {
    try {
        const request = {
            messages: [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: prompt,
                    },
                },
            ],
            maxTokens,
        };
        if (systemPrompt) {
            request.systemPrompt = systemPrompt;
        }
        const result = await server.request({
            method: 'sampling/createMessage',
            params: request,
        }, { method: 'sampling/createMessage' });
        if (result && typeof result === 'object' && 'content' in result) {
            const content = result.content;
            if (content.type === 'text') {
                return content.text;
            }
        }
        return null;
    }
    catch (error) {
        // Log error to stderr (not stdout, which is used for MCP messages)
        console.error('Sampling request failed:', error);
        return null;
    }
}
/**
 * Request security analysis sampling
 * Specialized sampling for security-related questions
 */
export async function requestSecurityAnalysis(server, context) {
    const systemPrompt = `You are a security expert analyzing Solana wallet operations. 
Provide concise, actionable security advice. Focus on:
- Key management best practices
- Common attack vectors
- Secure storage recommendations`;
    return requestSampling(server, context, systemPrompt, 512);
}
/**
 * Request wallet operation guidance
 * Specialized sampling for wallet operation questions
 */
export async function requestWalletGuidance(server, question) {
    const systemPrompt = `You are a helpful assistant guiding users through Solana wallet operations.
Provide clear, step-by-step instructions when needed.
Always emphasize security best practices.`;
    return requestSampling(server, question, systemPrompt, 1024);
}
//# sourceMappingURL=sampling.js.map
