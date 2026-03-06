import type { ServerState } from "../types.js";

export function readKeypairResource(
  id: string,
  state: ServerState,
): { contents: Array<{ uri: string; mimeType: string; text: string }> } {
  const keypair = state.generatedKeypairs.get(id);

  if (!keypair) {
    return {
      contents: [
        {
          uri: `solana://keypair/${id}`,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              error: "Keypair not found",
              message: `No keypair with ID "${id}" exists in the current session`,
              availableKeypairs: Array.from(state.generatedKeypairs.keys()),
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  // SECURITY: Private key is NEVER exposed via resource reads
  return {
    contents: [
      {
        uri: `solana://keypair/${id}`,
        mimeType: "application/json",
        text: JSON.stringify(
          {
            id,
            publicKey: keypair.publicKey,
            hasPrivateKey: true,
            note: "Private key stored in memory but not exposed. Use sign_message tool to sign.",
          },
          null,
          2,
        ),
      },
    ],
  };
}

export function listKeypairResources(
  state: ServerState,
): Array<{ uri: string; name: string; description: string; mimeType: string }> {
  return Array.from(state.generatedKeypairs.entries()).map(([id, kp]) => ({
    uri: `solana://keypair/${id}`,
    name: `Keypair: ${id}`,
    description: `Public key: ${kp.publicKey.substring(0, 8)}...`,
    mimeType: "application/json",
  }));
}
