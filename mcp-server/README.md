# Solana Wallet Toolkit MCP Server

A Model Context Protocol (MCP) server that exposes Solana wallet operations to AI assistants like Claude.

## Features

- **Generate Keypairs**: Create new Solana keypairs
- **Vanity Addresses**: Generate addresses with custom prefixes/suffixes
- **Sign Messages**: Sign arbitrary messages with keypairs
- **Verify Signatures**: Verify message signatures
- **Validate Addresses**: Check if Solana addresses are valid
- **Restore Keypairs**: Recover from seed phrases or private keys

## Installation

```bash
npm install
npm run build
```

## Usage

### With Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "solana-wallet": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"]
    }
  }
}
```

### Standalone

```bash
npm start
```

## Available Tools

| Tool | Description |
|------|-------------|
| `generate_keypair` | Generate a new Solana keypair |
| `generate_vanity` | Generate a vanity address with prefix/suffix |
| `sign_message` | Sign a message with a keypair |
| `verify_signature` | Verify a message signature |
| `validate_address` | Validate a Solana address format |
| `estimate_vanity_time` | Estimate time to find a vanity address |
| `restore_keypair` | Restore keypair from seed phrase or private key |

## Available Resources

| Resource | Description |
|----------|-------------|
| `solana://config` | Server configuration |
| `solana://keypair/{id}` | Access generated keypairs (public key only) |
| `solana://address/{pubkey}` | Address information |

## Available Prompts

| Prompt | Description |
|--------|-------------|
| `create_wallet` | Guided wallet creation workflow |
| `security_audit` | Security best practices checklist |
| `batch_generate` | Generate multiple keypairs at once |

## Security

⚠️ **CRITICAL**: This server handles cryptocurrency private keys.

- Private keys are **never logged** or persisted to disk
- Keys are **zeroized from memory** on shutdown
- All inputs are **strictly validated**
- Uses official Solana libraries only

## Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Protocol Version

This server implements MCP protocol version `2024-11-05`.

## License

MIT
