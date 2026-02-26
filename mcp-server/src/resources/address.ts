import { PublicKey } from '@solana/web3.js';
import { ServerState, ResourceResult } from '../types/index.js';

/**
 * Read address information resource
 * Validates and returns information about a Solana address
 */
export function readAddressResource(
  address: string,
  state: ServerState
): ResourceResult {
  // Handle empty address
  if (!address) {
    return {
      contents: [
        {
          uri: 'solana://address/',
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              error: 'Missing address',
              message: 'Please specify an address in the URI: solana://address/{pubkey}',
            },
            null,
            2
          ),
        },
      ],
    };
  }

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
