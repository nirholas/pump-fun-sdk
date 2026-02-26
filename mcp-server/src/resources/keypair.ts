import { ServerState, ResourceResult } from '../types/index.js';

/**
 * Read a keypair resource by ID
 * SECURITY: Never exposes private keys - only public information
 */
export function readKeypairResource(
  keypairId: string,
  state: ServerState
): ResourceResult {
  // Handle empty keypair ID
  if (!keypairId) {
    return {
      contents: [
        {
          uri: 'solana://keypair/',
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              error: 'Missing keypair ID',
              message: 'Please specify a keypair ID in the URI: solana://keypair/{id}',
              availableKeypairs: Array.from(state.generatedKeypairs.keys()),
            },
            null,
            2
          ),
        },
      ],
    };
  }

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

/**
 * List all available keypairs for resource listing
 * Returns resource definitions for all generated keypairs
 */
export function listKeypairResources(state: ServerState): Array<{
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}> {
  return Array.from(state.generatedKeypairs.entries()).map(([id, keypair]) => ({
    uri: `solana://keypair/${id}`,
    name: `Keypair: ${id}`,
    description: `Public key: ${keypair.publicKey.substring(0, 8)}...${keypair.publicKey.substring(keypair.publicKey.length - 4)}`,
    mimeType: 'application/json',
  }));
}
