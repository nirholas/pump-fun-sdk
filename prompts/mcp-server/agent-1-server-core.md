# Agent 1: MCP Server Core & Transport

## Role
You are a Claude Opus 4.5 agent responsible for building the core MCP server infrastructure. You will implement the JSON-RPC 2.0 protocol handler, transport layers, and server lifecycle management.

## Context
This MCP server will expose Solana Wallet Toolkit functionality to AI assistants. You're building the foundation that other agents will build upon.

## Your Deliverables

### 1. Project Setup
Create the MCP server project structure:

```bash
mkdir -p mcp-server/src/{transport,handlers,types,utils}
cd mcp-server
```

**package.json**:
```json
{
  "name": "@solana-wallet-toolkit/mcp-server",
  "version": "1.0.0",
  "description": "MCP server for Solana wallet operations",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "solana-wallet-mcp": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "test": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@solana/web3.js": "^1.98.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
```

### 2. TypeScript Configuration
**tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### 3. Type Definitions
**src/types/index.ts**:
```typescript
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
```

### 4. Server Core Implementation
**src/server.ts**:
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { MCP_VERSION, ServerCapabilities, ServerState } from './types/index.js';
import { registerToolHandlers } from './handlers/tools.js';
import { registerResourceHandlers } from './handlers/resources.js';
import { registerPromptHandlers } from './handlers/prompts.js';

export class SolanaWalletMCPServer {
  private server: Server;
  private state: ServerState;

  constructor() {
    this.state = {
      initialized: false,
      clientCapabilities: {},
      generatedKeypairs: new Map(),
    };

    this.server = new Server(
      {
        name: 'solana-wallet-toolkit',
        version: '1.0.0',
      },
      {
        capabilities: this.getCapabilities(),
      }
    );

    this.registerHandlers();
    this.setupErrorHandling();
  }

  private getCapabilities(): ServerCapabilities {
    return {
      tools: {
        listChanged: true,
      },
      resources: {
        subscribe: false,
        listChanged: true,
      },
      prompts: {
        listChanged: true,
      },
    };
  }

  private registerHandlers(): void {
    // Register all handlers with access to server state
    registerToolHandlers(this.server, this.state);
    registerResourceHandlers(this.server, this.state);
    registerPromptHandlers(this.server, this.state);
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.shutdown();
      process.exit(0);
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    // Log to stderr (stdout is for MCP communication)
    console.error('Solana Wallet MCP Server started');
    console.error(`Protocol version: ${MCP_VERSION}`);
  }

  async shutdown(): Promise<void> {
    // Zeroize any sensitive data
    for (const [id, keypair] of this.state.generatedKeypairs) {
      keypair.secretKey.fill(0);
    }
    this.state.generatedKeypairs.clear();
    
    console.error('Solana Wallet MCP Server shutdown');
  }

  getState(): ServerState {
    return this.state;
  }
}

// Factory function for testing
export function createServer(): SolanaWalletMCPServer {
  return new SolanaWalletMCPServer();
}
```

### 5. Entry Point
**src/index.ts**:
```typescript
#!/usr/bin/env node

import { SolanaWalletMCPServer } from './server.js';

async function main(): Promise<void> {
  const server = new SolanaWalletMCPServer();
  
  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main();
```

### 6. Handler Stubs (for other agents)
Create stub files that other agents will implement:

**src/handlers/tools.ts**:
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ServerState, ToolDefinition } from '../types/index.js';

// Tool definitions - Agent 2 will implement these
export const TOOLS: ToolDefinition[] = [
  {
    name: 'generate_keypair',
    description: 'Generate a new Solana keypair',
    inputSchema: {
      type: 'object',
      properties: {
        saveId: {
          type: 'string',
          description: 'Optional ID to save the keypair for later reference',
        },
      },
      required: [],
    },
  },
  {
    name: 'generate_vanity',
    description: 'Generate a Solana vanity address with custom prefix/suffix',
    inputSchema: {
      type: 'object',
      properties: {
        prefix: {
          type: 'string',
          description: 'Desired address prefix (Base58 characters only)',
        },
        suffix: {
          type: 'string',
          description: 'Desired address suffix (Base58 characters only)',
        },
        caseInsensitive: {
          type: 'boolean',
          description: 'Whether to match case-insensitively',
          default: false,
        },
        timeout: {
          type: 'number',
          description: 'Maximum time in seconds to search',
          default: 60,
        },
      },
      required: [],
    },
  },
  {
    name: 'sign_message',
    description: 'Sign a message with a keypair',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to sign',
        },
        keypairId: {
          type: 'string',
          description: 'ID of a previously generated keypair',
        },
        privateKey: {
          type: 'string',
          description: 'Base58-encoded private key (alternative to keypairId)',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'verify_signature',
    description: 'Verify a message signature',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The original message',
        },
        signature: {
          type: 'string',
          description: 'Base58-encoded signature',
        },
        publicKey: {
          type: 'string',
          description: 'Base58-encoded public key',
        },
      },
      required: ['message', 'signature', 'publicKey'],
    },
  },
  {
    name: 'validate_address',
    description: 'Validate a Solana address format',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'The Solana address to validate',
        },
      },
      required: ['address'],
    },
  },
  {
    name: 'estimate_vanity_time',
    description: 'Estimate time to find a vanity address',
    inputSchema: {
      type: 'object',
      properties: {
        prefix: {
          type: 'string',
          description: 'Desired prefix',
        },
        suffix: {
          type: 'string',
          description: 'Desired suffix',
        },
        caseInsensitive: {
          type: 'boolean',
          default: false,
        },
      },
      required: [],
    },
  },
  {
    name: 'restore_keypair',
    description: 'Restore a keypair from seed phrase or private key',
    inputSchema: {
      type: 'object',
      properties: {
        seedPhrase: {
          type: 'string',
          description: '12 or 24 word BIP39 seed phrase',
        },
        privateKey: {
          type: 'string',
          description: 'Base58-encoded private key',
        },
        saveId: {
          type: 'string',
          description: 'Optional ID to save the keypair',
        },
      },
      required: [],
    },
  },
];

export function registerToolHandlers(server: Server, state: ServerState): void {
  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  // Handle tool calls - Agent 2 will implement the actual logic
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Import tool implementations dynamically
    const { handleToolCall } = await import('../tools/index.js');
    
    try {
      const result = await handleToolCall(name, args || {}, state);
      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });
}
```

**src/handlers/resources.ts**:
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ServerState, ResourceDefinition } from '../types/index.js';

// Resource definitions - Agent 3 will implement these
export const RESOURCES: ResourceDefinition[] = [
  {
    uri: 'solana://config',
    name: 'Server Configuration',
    description: 'Current MCP server configuration',
    mimeType: 'application/json',
  },
];

export function registerResourceHandlers(server: Server, state: ServerState): void {
  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    // Include dynamically generated keypair resources
    const keypairResources: ResourceDefinition[] = Array.from(
      state.generatedKeypairs.keys()
    ).map((id) => ({
      uri: `solana://keypair/${id}`,
      name: `Keypair: ${id}`,
      description: `Generated keypair with ID ${id}`,
      mimeType: 'application/json',
    }));

    return {
      resources: [...RESOURCES, ...keypairResources],
    };
  });

  // Read resource content - Agent 3 will implement
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    
    const { handleReadResource } = await import('../resources/index.js');
    return handleReadResource(uri, state);
  });
}
```

**src/handlers/prompts.ts**:
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ServerState, PromptDefinition } from '../types/index.js';

// Prompt definitions - Agent 2 will implement these
export const PROMPTS: PromptDefinition[] = [
  {
    name: 'create_wallet',
    description: 'Guided workflow to create a new Solana wallet',
    arguments: [
      {
        name: 'type',
        description: 'Type of wallet: "standard" or "vanity"',
        required: false,
      },
    ],
  },
  {
    name: 'security_audit',
    description: 'Security best practices checklist for wallet management',
    arguments: [],
  },
  {
    name: 'batch_generate',
    description: 'Generate multiple keypairs at once',
    arguments: [
      {
        name: 'count',
        description: 'Number of keypairs to generate',
        required: true,
      },
    ],
  },
];

export function registerPromptHandlers(server: Server, state: ServerState): void {
  // List available prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: PROMPTS,
    };
  });

  // Get prompt content - Agent 2 will implement
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    const { handleGetPrompt } = await import('../prompts/index.js');
    return handleGetPrompt(name, args || {}, state);
  });
}
```

### 7. Utility Functions
**src/utils/validation.ts**:
```typescript
import { z } from 'zod';

// Base58 character set (no 0, O, I, l)
const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]+$/;

export const Base58Schema = z.string().regex(BASE58_REGEX, 'Invalid Base58 string');

export const SolanaAddressSchema = z
  .string()
  .length(44, 'Solana addresses must be 44 characters')
  .regex(BASE58_REGEX, 'Invalid Base58 characters in address');

export const PrefixSchema = z
  .string()
  .max(6, 'Prefix too long (max 6 characters)')
  .regex(BASE58_REGEX, 'Prefix must contain only Base58 characters');

export const SuffixSchema = z
  .string()
  .max(6, 'Suffix too long (max 6 characters)')
  .regex(BASE58_REGEX, 'Suffix must contain only Base58 characters');

export function isValidBase58(str: string): boolean {
  return BASE58_REGEX.test(str);
}

export function isValidSolanaAddress(address: string): boolean {
  try {
    SolanaAddressSchema.parse(address);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeInput(input: string): string {
  // Remove any non-printable characters
  return input.replace(/[^\x20-\x7E]/g, '');
}
```

---

## Testing Your Implementation

After implementation, verify:

```bash
# Build the project
npm run build

# Test that it starts
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node dist/index.js

# Should respond with server capabilities
```

---

## Success Criteria

1. ✅ Project structure created correctly
2. ✅ TypeScript compiles without errors
3. ✅ Server starts and handles initialize request
4. ✅ Handler stubs are ready for other agents
5. ✅ Proper error handling and shutdown
6. ✅ Memory zeroization on shutdown

---

## Handoff Notes for Other Agents

**For Agent 2 (Tools & Prompts)**:
- Implement tool logic in `src/tools/*.ts`
- Export `handleToolCall` from `src/tools/index.ts`
- Implement prompt logic in `src/prompts/*.ts`
- Export `handleGetPrompt` from `src/prompts/index.ts`

**For Agent 3 (Resources)**:
- Implement resource handlers in `src/resources/*.ts`
- Export `handleReadResource` from `src/resources/index.ts`
- Dynamic resources for keypairs are already registered

**For Agent 4 (Testing)**:
- Test files go in `tests/` directory
- Use vitest for testing
- Mock the transport for unit tests

---

## Security Reminders

1. **NEVER log private keys** - Use console.error for server messages
2. **Zeroize on shutdown** - Already implemented in server.ts
3. **Validate all inputs** - Use Zod schemas
4. **Stdout is sacred** - Only JSON-RPC messages go to stdout
