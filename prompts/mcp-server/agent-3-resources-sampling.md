# Agent 3: MCP Resources & Sampling Implementation

## Role
You are a Claude Opus 4.5 agent responsible for implementing MCP resources and sampling capabilities. Resources provide dynamic data access, and sampling enables the server to request LLM completions from the client.

## Context
Agents 1 and 2 have built the server core and tools. You will implement the resource system for accessing keypairs and configuration, plus optional sampling support.

---

## Your Deliverables

### 1. Resource Index
**src/resources/index.ts**:
```typescript
import { ServerState, ResourceResult } from '../types/index.js';
import { readKeypairResource } from './keypair.js';
import { readConfigResource } from './config.js';
import { readAddressResource } from './address.js';

export async function handleReadResource(
  uri: string,
  state: ServerState
): Promise<ResourceResult> {
  // Parse the URI
  const url = new URL(uri);
  
  if (url.protocol !== 'solana:') {
    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: `Unsupported protocol: ${url.protocol}`,
        },
      ],
    };
  }

  const path = url.pathname.replace(/^\/\//, ''); // Remove leading //
  const segments = path.split('/');
  const resourceType = segments[0];
  const resourceId = segments.slice(1).join('/');

  switch (resourceType) {
    case 'keypair':
      return readKeypairResource(resourceId, state);
    case 'config':
      return readConfigResource(state);
    case 'address':
      return readAddressResource(resourceId, state);
    default:
      return {
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: `Unknown resource type: ${resourceType}`,
          },
        ],
      };
  }
}
```

### 2. Keypair Resource
**src/resources/keypair.ts**:
```typescript
import { ServerState, ResourceResult } from '../types/index.js';

export function readKeypairResource(
  keypairId: string,
  state: ServerState
): ResourceResult {
  const keypair = state.generatedKeypairs.get(keypairId);

  if (!keypair) {
    return {
      contents: [
        {
          uri: `solana://keypair/${keypairId}`,
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              error: 'Keypair not found',
              message: `No keypair with ID "${keypairId}" exists in the current session`,
              availableKeypairs: Array.from(state.generatedKeypairs.keys()),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  // SECURITY: Never expose the private key in resource reads
  // Only return public information
  return {
    contents: [
      {
        uri: `solana://keypair/${keypairId}`,
        mimeType: 'application/json',
        text: JSON.stringify(
          {
            id: keypairId,
            publicKey: keypair.publicKey,
            // Intentionally NOT including secretKey
            hasPrivateKey: true,
            note: 'Private key is stored in memory but not exposed via resources. Use sign_message tool to sign.',
          },
          null,
          2
        ),
      },
    ],
  };
}

// List all available keypairs (for resource listing)
export function listKeypairResources(state: ServerState): Array<{
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}> {
  return Array.from(state.generatedKeypairs.entries()).map(([id, keypair]) => ({
    uri: `solana://keypair/${id}`,
    name: `Keypair: ${id}`,
    description: `Public key: ${keypair.publicKey.substring(0, 8)}...`,
    mimeType: 'application/json',
  }));
}
```

### 3. Config Resource
**src/resources/config.ts**:
```typescript
import { ServerState, ResourceResult } from '../types/index.js';
import { MCP_VERSION } from '../types/index.js';

interface ServerConfig {
  version: string;
  mcpVersion: string;
  capabilities: {
    tools: string[];
    resources: string[];
    prompts: string[];
  };
  session: {
    keypairsInMemory: number;
    startedAt: string;
  };
  security: {
    privateKeyExposure: 'never';
    inputValidation: 'strict';
    memoryZeroization: 'on_shutdown';
  };
  performance: {
    vanityKeysPerSecond: number;
    maxVanityTimeout: number;
  };
}

// Track when the server started
const SERVER_START_TIME = new Date().toISOString();

export function readConfigResource(state: ServerState): ResourceResult {
  const config: ServerConfig = {
    version: '1.0.0',
    mcpVersion: MCP_VERSION,
    capabilities: {
      tools: [
        'generate_keypair',
        'generate_vanity',
        'sign_message',
        'verify_signature',
        'validate_address',
        'estimate_vanity_time',
        'restore_keypair',
      ],
      resources: ['solana://keypair/{id}', 'solana://config', 'solana://address/{pubkey}'],
      prompts: ['create_wallet', 'security_audit', 'batch_generate'],
    },
    session: {
      keypairsInMemory: state.generatedKeypairs.size,
      startedAt: SERVER_START_TIME,
    },
    security: {
      privateKeyExposure: 'never',
      inputValidation: 'strict',
      memoryZeroization: 'on_shutdown',
    },
    performance: {
      vanityKeysPerSecond: 15000,
      maxVanityTimeout: 300,
    },
  };

  return {
    contents: [
      {
        uri: 'solana://config',
        mimeType: 'application/json',
        text: JSON.stringify(config, null, 2),
      },
    ],
  };
}
```

### 4. Address Resource
**src/resources/address.ts**:
```typescript
import { PublicKey } from '@solana/web3.js';
import { ServerState, ResourceResult } from '../types/index.js';

export function readAddressResource(
  address: string,
  state: ServerState
): ResourceResult {
  // Validate the address
  try {
    const pubKey = new PublicKey(address);
    const isOnCurve = PublicKey.isOnCurve(pubKey.toBytes());

    // Check if this address belongs to any of our generated keypairs
    let matchingKeypairId: string | null = null;
    for (const [id, keypair] of state.generatedKeypairs) {
      if (keypair.publicKey === address) {
        matchingKeypairId = id;
        break;
      }
    }

    const addressInfo = {
      address,
      valid: true,
      isOnCurve,
      type: isOnCurve ? 'standard_keypair' : 'program_derived_address',
      inSession: matchingKeypairId !== null,
      sessionKeypairId: matchingKeypairId,
      details: {
        bytes: Array.from(pubKey.toBytes()),
        base58: pubKey.toBase58(),
      },
    };

    return {
      contents: [
        {
          uri: `solana://address/${address}`,
          mimeType: 'application/json',
          text: JSON.stringify(addressInfo, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      contents: [
        {
          uri: `solana://address/${address}`,
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              address,
              valid: false,
              error: error instanceof Error ? error.message : 'Invalid address',
            },
            null,
            2
          ),
        },
      ],
    };
  }
}
```

---

### 5. Update Resource Handler for Dynamic Resources

**src/handlers/resources.ts** (updated version):
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ServerState, ResourceDefinition } from '../types/index.js';
import { listKeypairResources } from '../resources/keypair.js';

// Static resource definitions
export const STATIC_RESOURCES: ResourceDefinition[] = [
  {
    uri: 'solana://config',
    name: 'Server Configuration',
    description: 'Current MCP server configuration and capabilities',
    mimeType: 'application/json',
  },
];

// Resource templates for dynamic resources
export const RESOURCE_TEMPLATES = [
  {
    uriTemplate: 'solana://keypair/{id}',
    name: 'Keypair',
    description: 'Access a generated keypair by ID',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'solana://address/{pubkey}',
    name: 'Address Info',
    description: 'Get information about a Solana address',
    mimeType: 'application/json',
  },
];

export function registerResourceHandlers(server: Server, state: ServerState): void {
  // List available resources (static + dynamic keypairs)
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const keypairResources = listKeypairResources(state);

    return {
      resources: [...STATIC_RESOURCES, ...keypairResources],
    };
  });

  // List resource templates
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    return {
      resourceTemplates: RESOURCE_TEMPLATES,
    };
  });

  // Read resource content
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    const { handleReadResource } = await import('../resources/index.js');
    return handleReadResource(uri, state);
  });
}
```

---

### 6. Sampling Implementation (Optional Advanced Feature)

Sampling allows the MCP server to request LLM completions from the client. This is useful for complex workflows.

**src/handlers/sampling.ts**:
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ServerState } from '../types/index.js';

// Sampling capability types
interface CreateMessageRequest {
  messages: Array<{
    role: 'user' | 'assistant';
    content: {
      type: 'text';
      text: string;
    };
  }>;
  modelPreferences?: {
    hints?: Array<{ name?: string }>;
    intelligencePriority?: number;
    speedPriority?: number;
  };
  systemPrompt?: string;
  maxTokens: number;
}

interface CreateMessageResult {
  role: 'assistant';
  content: {
    type: 'text';
    text: string;
  };
  model: string;
  stopReason?: 'endTurn' | 'stopSequence' | 'maxTokens';
}

export function registerSamplingHandlers(server: Server, state: ServerState): void {
  // The MCP server can request sampling from the client
  // This is done by calling server.request() with the sampling method
  
  // Example: Server-initiated sampling (if client supports it)
  // This is typically used for complex multi-step workflows
}

// Helper function for server-initiated sampling
export async function requestSampling(
  server: Server,
  prompt: string,
  systemPrompt?: string,
  maxTokens: number = 1024
): Promise<string | null> {
  try {
    const result = await server.request(
      {
        method: 'sampling/createMessage',
        params: {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: prompt,
              },
            },
          ],
          systemPrompt,
          maxTokens,
        },
      },
      { method: 'sampling/createMessage' } as any
    );

    if (result && typeof result === 'object' && 'content' in result) {
      const content = (result as CreateMessageResult).content;
      if (content.type === 'text') {
        return content.text;
      }
    }
    return null;
  } catch (error) {
    console.error('Sampling request failed:', error);
    return null;
  }
}
```

---

### 7. Resource Subscriptions (Optional)

For clients that want to be notified when resources change:

**src/resources/subscriptions.ts**:
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ServerState } from '../types/index.js';

// Track subscriptions
const subscriptions = new Map<string, Set<string>>(); // uri -> Set of subscription IDs

export function registerResourceSubscriptions(server: Server, state: ServerState): void {
  // Note: Resource subscriptions are optional in MCP
  // Implement if your use case requires real-time updates
  
  // Subscribe to resource changes
  // server.setRequestHandler(SubscribeResourceSchema, async (request) => { ... });
  
  // Unsubscribe
  // server.setRequestHandler(UnsubscribeResourceSchema, async (request) => { ... });
}

// Notify subscribers when a resource changes
export function notifyResourceChanged(server: Server, uri: string): void {
  // Send notification to subscribed clients
  // This would use server.notification() method
  console.error(`Resource changed: ${uri}`);
}

// Call this when a new keypair is generated
export function onKeypairGenerated(server: Server, keypairId: string): void {
  notifyResourceChanged(server, `solana://keypair/${keypairId}`);
}
```

---

### 8. Types Update

Add to **src/types/index.ts**:
```typescript
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
```

---

## Testing Resources

```bash
# Test config resource
echo '{"jsonrpc":"2.0","id":1,"method":"resources/read","params":{"uri":"solana://config"}}' | node dist/index.js

# First generate a keypair with ID
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"generate_keypair","arguments":{"saveId":"test-1"}}}' | node dist/index.js

# Then read it as a resource
echo '{"jsonrpc":"2.0","id":2,"method":"resources/read","params":{"uri":"solana://keypair/test-1"}}' | node dist/index.js

# Test address resource
echo '{"jsonrpc":"2.0","id":3,"method":"resources/read","params":{"uri":"solana://address/11111111111111111111111111111111"}}' | node dist/index.js
```

---

## Success Criteria

1. ✅ Config resource returns server information
2. ✅ Keypair resources work for generated keys
3. ✅ Address resource validates and returns info
4. ✅ Resource templates are properly defined
5. ✅ Private keys are NEVER exposed via resources
6. ✅ Dynamic resource listing includes generated keypairs

---

## Security Notes

### Critical: Private Key Protection
- **NEVER** include `secretKey` in resource responses
- Resources are for **read-only** public information
- To use a private key, clients must use the `sign_message` tool

### Resource URI Security
- Validate all URIs before processing
- Only support the `solana:` protocol
- Sanitize resource IDs to prevent injection

---

## Handoff Notes

**For Agent 4 (Testing)**:
- Test all resource URIs
- Verify private keys are never exposed
- Test resource listing with multiple keypairs
- Test invalid URI handling
