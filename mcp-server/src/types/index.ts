import { z } from 'zod';

// MCP Protocol Version
export const MCP_VERSION = '2024-11-05';

// Server capabilities we support
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

// Tool definition schema
export const ToolInputSchema = z.object({
  type: z.literal('object'),
  properties: z.record(z.any()),
  required: z.array(z.string()).optional(),
});

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.infer<typeof ToolInputSchema>;
}

// Resource definition
export interface ResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

// Prompt definition
export interface PromptDefinition {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

// Server state
export interface ServerState {
  initialized: boolean;
  clientCapabilities: Record<string, unknown>;
  generatedKeypairs: Map<string, { publicKey: string; secretKey: Uint8Array }>;
}

// Result types
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

// Tool call arguments types
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

// Prompt argument types
export interface CreateWalletPromptArgs {
  type?: 'standard' | 'vanity';
}

export interface BatchGeneratePromptArgs {
  count: string;
}

// Resource template definition
export interface ResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

// Sampling types
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
    hints?: Array<{ name?: string }>;
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
