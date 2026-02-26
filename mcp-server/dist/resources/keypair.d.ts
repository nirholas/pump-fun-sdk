import { ServerState, ResourceResult } from '../types/index.js';
/**
 * Read a keypair resource by ID
 * SECURITY: Never exposes private keys - only public information
 */
export declare function readKeypairResource(keypairId: string, state: ServerState): ResourceResult;
/**
 * List all available keypairs for resource listing
 * Returns resource definitions for all generated keypairs
 */
export declare function listKeypairResources(state: ServerState): Array<{
    uri: string;
    name: string;
    description: string;
    mimeType: string;
}>;
//# sourceMappingURL=keypair.d.ts.map