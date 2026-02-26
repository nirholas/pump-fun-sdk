/**
 * Resource implementations for MCP server
 * This file exports the handleReadResource function that routes to appropriate handlers
 */

import { ServerState, ResourceResult } from '../types/index.js';
import { readKeypairResource } from './keypair.js';
import { readConfigResource } from './config.js';
import { readAddressResource } from './address.js';

/**
 * Handle a resource read request by parsing the URI and routing to the appropriate handler
 * @param uri - The URI of the resource to read (solana:// protocol)
 * @param state - The server state
 * @returns The resource content
 */
export async function handleReadResource(
  uri: string,
  state: ServerState
): Promise<ResourceResult> {
  // Parse the URI
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: `Invalid URI format: ${uri}`,
        },
      ],
    };
  }

  // Only support solana: protocol
  if (url.protocol !== 'solana:') {
    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: `Unsupported protocol: ${url.protocol}. Only solana: protocol is supported.`,
        },
      ],
    };
  }

  // Parse the path - remove leading // from pathname
  const path = url.pathname.replace(/^\/\//, '');
  const segments = path.split('/').filter((s) => s.length > 0);

  if (segments.length === 0) {
    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: 'Invalid resource URI: no resource type specified',
        },
      ],
    };
  }

  const resourceType = segments[0];
  const resourceId = segments.slice(1).join('/');

  // Route to appropriate resource handler
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
            text: `Unknown resource type: ${resourceType}. Supported types: keypair, config, address`,
          },
        ],
      };
  }
}
