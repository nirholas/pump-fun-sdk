import { MCP_VERSION } from '../types/index.js';
// Track when the server started
const SERVER_START_TIME = new Date().toISOString();
/**
 * Read the server configuration resource
 * Returns current server capabilities, session info, and security settings
 */
export function readConfigResource(state) {
    const config = {
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
            resources: [
                'solana://keypair/{id}',
                'solana://config',
                'solana://address/{pubkey}',
            ],
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
//# sourceMappingURL=config.js.map