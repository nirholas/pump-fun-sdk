import { z } from 'zod';
export declare const MCP_VERSION = "2024-11-05";
export interface ServerCapabilities {
    tools?: {
        listChanged?: boolean;
    };
    resources?: {
        subscribe?: boolean;
        listChanged?: boolean;
    };
    prompts?: {
        listChanged?: boolean;
    };
    sampling?: Record<string, never>;
}
export declare const ToolInputSchema: z.ZodObject<{
    type: z.ZodLiteral<"object">;
    properties: z.ZodRecord<z.ZodString, z.ZodAny>;
    required: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "object";
    properties: Record<string, any>;
    required?: string[] | undefined;
}, {
    type: "object";
    properties: Record<string, any>;
    required?: string[] | undefined;
}>;
export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: z.infer<typeof ToolInputSchema>;
}
export interface ResourceDefinition {
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
}
export interface PromptDefinition {
    name: string;
    description?: string;
    arguments?: Array<{
        name: string;
        description?: string;
        required?: boolean;
    }>;
}
export interface ServerState {
    initialized: boolean;
    clientCapabilities: Record<string, unknown>;
    generatedKeypairs: Map<string, {
        publicKey: string;
        secretKey: Uint8Array;
    }>;
}
export interface ToolResult {
    content: Array<{
        type: 'text' | 'image' | 'resource';
        text?: string;
        data?: string;
        mimeType?: string;
    }>;
    isError?: boolean;
}
export interface ResourceResult {
    contents: Array<{
        uri: string;
        mimeType?: string;
        text?: string;
        blob?: string;
    }>;
}
export interface PromptResult {
    description?: string;
    messages: Array<{
        role: 'user' | 'assistant';
        content: {
            type: 'text' | 'image' | 'resource';
            text?: string;
        };
    }>;
}
export interface GenerateKeypairArgs {
    saveId?: string;
}
export interface GenerateVanityArgs {
    prefix?: string;
    suffix?: string;
    caseInsensitive?: boolean;
    timeout?: number;
}
export interface SignMessageArgs {
    message: string;
    keypairId?: string;
    privateKey?: string;
}
export interface VerifySignatureArgs {
    message: string;
    signature: string;
    publicKey: string;
}
export interface ValidateAddressArgs {
    address: string;
}
export interface EstimateVanityTimeArgs {
    prefix?: string;
    suffix?: string;
    caseInsensitive?: boolean;
}
export interface RestoreKeypairArgs {
    seedPhrase?: string;
    privateKey?: string;
    saveId?: string;
}
export interface CreateWalletPromptArgs {
    type?: 'standard' | 'vanity';
}
export interface BatchGeneratePromptArgs {
    count: string;
}
export interface ResourceTemplate {
    uriTemplate: string;
    name: string;
    description?: string;
    mimeType?: string;
}
export interface SamplingMessage {
    role: 'user' | 'assistant';
    content: {
        type: 'text' | 'image';
        text?: string;
        data?: string;
        mimeType?: string;
    };
}
export interface SamplingRequest {
    messages: SamplingMessage[];
    modelPreferences?: {
        hints?: Array<{
            name?: string;
        }>;
        intelligencePriority?: number;
        speedPriority?: number;
    };
    systemPrompt?: string;
    maxTokens: number;
}
export interface SamplingResponse {
    role: 'assistant';
    content: {
        type: 'text';
        text: string;
    };
    model: string;
    stopReason?: 'endTurn' | 'stopSequence' | 'maxTokens';
}
//# sourceMappingURL=index.d.ts.map