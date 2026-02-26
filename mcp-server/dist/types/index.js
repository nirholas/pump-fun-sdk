import { z } from 'zod';
// MCP Protocol Version
export const MCP_VERSION = '2024-11-05';
// Tool definition schema
export const ToolInputSchema = z.object({
    type: z.literal('object'),
    properties: z.record(z.any()),
    required: z.array(z.string()).optional(),
});
//# sourceMappingURL=index.js.map
