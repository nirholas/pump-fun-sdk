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
    description: 'Access a generated keypair by ID (public key only, private key never exposed)',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'solana://address/{pubkey}',
    name: 'Address Info',
    description: 'Get information about a Solana address including validation and type',
    mimeType: 'application/json',
  },
];

export function registerResourceHandlers(server: Server, state: ServerState): void {
  // List available resources (static + dynamic keypairs)
  server.setRequestHandler(ListResourcesRequestSchema, async (_request, _extra) => {
    const keypairResources = listKeypairResources(state);

    return {
      resources: [...STATIC_RESOURCES, ...keypairResources],
    };
  });

  // List resource templates
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async (_request, _extra) => {
    return {
      resourceTemplates: RESOURCE_TEMPLATES,
    };
  });

  // Read resource content
  server.setRequestHandler(ReadResourceRequestSchema, async (request, _extra) => {
    const { uri } = request.params;

    const { handleReadResource } = await import('../resources/index.js');
    return handleReadResource(uri, state) as any;
  });
}
