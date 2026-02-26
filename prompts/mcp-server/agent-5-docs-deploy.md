# Agent 5: Documentation & Deployment

## Role
You are a Claude Opus 4.5 agent responsible for creating comprehensive documentation and preparing the MCP server for deployment. Your work ensures users can install, configure, and use the server effectively.

## Context
Agents 1-4 have built and tested the complete MCP server. You will create all documentation, examples, and deployment configurations to make it production-ready.

---

## Your Deliverables

### 1. Main README

**mcp-server/README.md**:
```markdown
# Solana Wallet Toolkit MCP Server

A Model Context Protocol (MCP) server that provides Solana wallet operations to AI assistants like Claude.

## Features

- **Generate Keypairs** - Create new Solana wallets
- **Vanity Addresses** - Generate addresses with custom prefixes/suffixes
- **Sign Messages** - Sign arbitrary messages with keypairs
- **Verify Signatures** - Verify message signatures
- **Validate Addresses** - Check Solana address validity
- **Time Estimates** - Estimate vanity address generation time

## Installation

### From npm

```bash
npm install -g @solana-wallet-toolkit/mcp-server
```

### From Source

```bash
git clone https://github.com/your-org/solana-wallet-toolkit.git
cd solana-wallet-toolkit/mcp-server
npm install
npm run build
```

## Usage with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "solana-wallet": {
      "command": "npx",
      "args": ["-y", "@solana-wallet-toolkit/mcp-server"]
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "solana-wallet": {
      "command": "solana-wallet-mcp"
    }
  }
}
```

## Available Tools

### `generate_keypair`
Generate a new Solana keypair.

**Parameters:**
- `saveId` (optional): ID to save the keypair for later reference

**Example:**
```
Generate a new Solana wallet and save it as "my-wallet"
```

### `generate_vanity`
Generate a vanity address with custom prefix/suffix.

**Parameters:**
- `prefix` (optional): Desired address prefix (Base58 chars)
- `suffix` (optional): Desired address suffix (Base58 chars)
- `caseInsensitive` (default: false): Match case-insensitively
- `timeout` (default: 60): Maximum seconds to search
- `saveId` (optional): ID to save the keypair

**Example:**
```
Create a vanity address starting with "Sol" (case-insensitive)
```

### `sign_message`
Sign a message with a keypair.

**Parameters:**
- `message`: The message to sign
- `keypairId`: ID of a previously saved keypair
- `privateKey`: OR provide a Base58-encoded private key

**Example:**
```
Sign the message "Hello, Solana!" with my-wallet
```

### `verify_signature`
Verify a message signature.

**Parameters:**
- `message`: The original message
- `signature`: Base58-encoded signature
- `publicKey`: Base58-encoded public key

**Example:**
```
Verify this signature is valid for the message
```

### `validate_address`
Validate a Solana address format.

**Parameters:**
- `address`: The address to validate

**Example:**
```
Is this a valid Solana address: 11111111111111111111111111111111
```

### `estimate_vanity_time`
Estimate time to find a vanity address.

**Parameters:**
- `prefix` (optional): Desired prefix
- `suffix` (optional): Desired suffix
- `caseInsensitive` (default: false)

**Example:**
```
How long would it take to find an address starting with "ABC"?
```

### `restore_keypair`
Restore a keypair from a private key.

**Parameters:**
- `privateKey`: Base58-encoded private key
- `saveId` (optional): ID to save the restored keypair

## Resources

The server provides these resources:

- `solana://config` - Server configuration
- `solana://keypair/{id}` - Access generated keypairs (public info only)
- `solana://address/{pubkey}` - Address information

## Prompts

Interactive prompts for guided workflows:

- `create_wallet` - Guided wallet creation
- `security_audit` - Security best practices check
- `batch_generate` - Generate multiple keypairs

## Security

### Key Handling
- Private keys are **NEVER** logged
- Private keys are **NEVER** returned in resources
- Keys exist only in memory during the session
- Memory is zeroized on shutdown

### Dependencies
This server uses **ONLY** official libraries:
- `@solana/web3.js` - Official Solana SDK
- `@modelcontextprotocol/sdk` - Official MCP SDK

### Best Practices
- Use this tool on a secure, offline machine when possible
- Never share generated private keys
- Store private keys in a secure password manager or hardware wallet
- Consider this server for development/testing; use hardware wallets for production funds

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## Troubleshooting

### Server won't start
- Ensure Node.js 18+ is installed
- Run `npm install` to install dependencies
- Check for port conflicts if using SSE transport

### Claude Desktop doesn't see the server
- Verify the configuration file path
- Ensure the command is correct
- Check Claude Desktop logs for errors

### Vanity generation is slow
- Use shorter prefixes (each char adds ~58x difficulty)
- Enable case-insensitive matching
- Consider using the Rust implementation for faster generation

## License

MIT

## Contributing

Contributions welcome! Please read the security guidelines before submitting PRs.
```

---

### 2. Claude Desktop Configuration Examples

**examples/claude-desktop.json**:
```json
{
  "mcpServers": {
    "solana-wallet": {
      "command": "npx",
      "args": ["-y", "@solana-wallet-toolkit/mcp-server"],
      "env": {}
    }
  }
}
```

**examples/claude-desktop-local.json** (for local development):
```json
{
  "mcpServers": {
    "solana-wallet": {
      "command": "node",
      "args": ["/path/to/solana-wallet-toolkit/mcp-server/dist/index.js"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

---

### 3. Usage Examples

**examples/usage.md**:
```markdown
# MCP Server Usage Examples

## Basic Wallet Creation

Ask Claude:
> Create a new Solana wallet for me

Claude will use the `generate_keypair` tool and provide you with:
- Public key (your address)
- Private key (keep this secret!)
- Instructions for importing into wallets

## Vanity Address Generation

Ask Claude:
> I want a Solana address that starts with "Pay". How long will it take?

Claude will:
1. Use `estimate_vanity_time` to estimate difficulty
2. Ask if you want to proceed
3. Use `generate_vanity` to find the address

## Message Signing

Ask Claude:
> Sign the message "I agree to the terms" with my wallet

Claude will:
1. Use `sign_message` with your saved keypair
2. Return the signature
3. Optionally verify it worked

## Security Audit

Ask Claude:
> Run a security audit on my wallet setup

Claude will use the `security_audit` prompt to:
- Review best practices
- Check for potential issues
- Provide recommendations

## Batch Operations

Ask Claude:
> Generate 5 test wallets for my dApp development

Claude will use the `batch_generate` prompt to:
- Create multiple keypairs
- Save them with IDs
- Provide a summary table

## Example Conversation

**User:** I need a vanity address for my NFT project. Can you help?

**Claude:** I'd be happy to help you create a vanity Solana address! What prefix or suffix would you like your address to have?

**User:** I want it to start with "NFT"

**Claude:** Let me first estimate how long that might take...

*Uses estimate_vanity_time tool*

For a 3-character prefix "NFT" (case-sensitive), it would take approximately:
- Expected attempts: ~195,000
- Estimated time: ~13 seconds

Would you like me to generate this address? I can also make it case-insensitive which would be faster.

**User:** Yes, case-insensitive is fine

**Claude:** *Uses generate_vanity tool*

I found your vanity address:

**Public Key:** NfT8x...

**Private Key:** [REDACTED - shown only once]

⚠️ Important: Store this private key securely and never share it!

Would you like me to explain how to import this into Phantom or another wallet?
```

---

### 4. API Documentation

**docs/API.md**:
```markdown
# MCP Server API Documentation

## Protocol

This server implements MCP (Model Context Protocol) version `2024-11-05`.

### Transport

- **Primary:** stdio (standard input/output)
- **Optional:** SSE (Server-Sent Events) - not yet implemented

### Message Format

All messages use JSON-RPC 2.0 format:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "method_name",
  "params": {}
}
```

---

## Methods

### initialize

Negotiate capabilities with the client.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "claude-desktop",
      "version": "1.0.0"
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": { "listChanged": true },
      "resources": { "subscribe": false, "listChanged": true },
      "prompts": { "listChanged": true }
    },
    "serverInfo": {
      "name": "solana-wallet-toolkit",
      "version": "1.0.0"
    }
  }
}
```

---

### tools/list

List available tools.

**Response:**
```json
{
  "tools": [
    {
      "name": "generate_keypair",
      "description": "Generate a new Solana keypair",
      "inputSchema": {
        "type": "object",
        "properties": {
          "saveId": { "type": "string" }
        }
      }
    }
    // ... more tools
  ]
}
```

---

### tools/call

Execute a tool.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "generate_keypair",
    "arguments": {
      "saveId": "my-wallet"
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Generated keypair (saved as \"my-wallet\"):\n\nPublic Key: ..."
      }
    ]
  }
}
```

---

### resources/list

List available resources.

**Response:**
```json
{
  "resources": [
    {
      "uri": "solana://config",
      "name": "Server Configuration",
      "mimeType": "application/json"
    },
    {
      "uri": "solana://keypair/my-wallet",
      "name": "Keypair: my-wallet",
      "mimeType": "application/json"
    }
  ]
}
```

---

### resources/read

Read a resource.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "resources/read",
  "params": {
    "uri": "solana://config"
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "contents": [
      {
        "uri": "solana://config",
        "mimeType": "application/json",
        "text": "{\"version\":\"1.0.0\",...}"
      }
    ]
  }
}
```

---

### prompts/list

List available prompts.

**Response:**
```json
{
  "prompts": [
    {
      "name": "create_wallet",
      "description": "Guided workflow to create a new Solana wallet",
      "arguments": [
        {
          "name": "type",
          "description": "Type: \"standard\" or \"vanity\"",
          "required": false
        }
      ]
    }
  ]
}
```

---

### prompts/get

Get a prompt template.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "prompts/get",
  "params": {
    "name": "create_wallet",
    "arguments": {
      "type": "vanity"
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "description": "Create a new Solana vanity wallet",
    "messages": [
      {
        "role": "user",
        "content": {
          "type": "text",
          "text": "I want to create a new Solana vanity wallet..."
        }
      }
    ]
  }
}
```

---

## Error Handling

Errors are returned in JSON-RPC format:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": "Prefix must contain only Base58 characters"
  }
}
```

### Error Codes

| Code | Meaning |
|------|---------|
| -32700 | Parse error |
| -32600 | Invalid request |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32603 | Internal error |
```

---

### 5. Deployment Scripts

**scripts/publish.sh**:
```bash
#!/bin/bash
set -e

echo "🚀 Publishing MCP Server to npm..."

# Ensure we're in the right directory
cd "$(dirname "$0")/../mcp-server"

# Run tests first
echo "📋 Running tests..."
npm test

# Build
echo "🔨 Building..."
npm run build

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Error: Uncommitted changes detected"
  exit 1
fi

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
echo "📦 Version: $VERSION"

# Confirm
read -p "Publish version $VERSION? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled"
  exit 1
fi

# Publish
npm publish --access public

echo "✅ Published @solana-wallet-toolkit/mcp-server@$VERSION"
```

**scripts/docker-build.sh**:
```bash
#!/bin/bash
set -e

echo "🐳 Building Docker image..."

cd "$(dirname "$0")/../mcp-server"

docker build -t solana-wallet-mcp:latest .
docker tag solana-wallet-mcp:latest ghcr.io/your-org/solana-wallet-mcp:latest

echo "✅ Docker image built"
echo "To push: docker push ghcr.io/your-org/solana-wallet-mcp:latest"
```

---

### 6. Dockerfile

**mcp-server/Dockerfile**:
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built files
COPY dist/ ./dist/

# Create non-root user
RUN addgroup -g 1001 -S mcp && \
    adduser -S mcp -u 1001 -G mcp
USER mcp

# Entry point
ENTRYPOINT ["node", "dist/index.js"]
```

---

### 7. GitHub Actions Workflow

**.github/workflows/mcp-server.yml**:
```yaml
name: MCP Server CI

on:
  push:
    paths:
      - 'mcp-server/**'
  pull_request:
    paths:
      - 'mcp-server/**'

defaults:
  run:
    working-directory: mcp-server

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: mcp-server/package-lock.json
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Run tests
        run: npm test
      
      - name: Security audit
        run: npm audit --audit-level=high

  publish:
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      
      - name: Install and build
        run: |
          npm ci
          npm run build
      
      - name: Publish to npm
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

### 8. Changelog

**mcp-server/CHANGELOG.md**:
```markdown
# Changelog

All notable changes to the MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-XX-XX

### Added
- Initial release
- Tools: generate_keypair, generate_vanity, sign_message, verify_signature, validate_address, estimate_vanity_time, restore_keypair
- Resources: solana://config, solana://keypair/{id}, solana://address/{pubkey}
- Prompts: create_wallet, security_audit, batch_generate
- Full MCP protocol compliance (version 2024-11-05)
- Comprehensive test suite
- Security audit completed

### Security
- Private keys never logged or exposed via resources
- Memory zeroization on shutdown
- Input validation on all endpoints
- Official Solana libraries only (@solana/web3.js)
```

---

### 9. Contributing Guide

**mcp-server/CONTRIBUTING.md**:
```markdown
# Contributing to Solana Wallet MCP Server

Thank you for your interest in contributing!

## Security First

This project handles cryptocurrency private keys. Security is paramount.

### Before Contributing

1. Read the security audit in `security/MCP_SECURITY_AUDIT.md`
2. Understand the key handling requirements
3. Never add dependencies that handle cryptographic operations

### Pull Request Requirements

- [ ] All tests pass
- [ ] No new dependencies without approval
- [ ] Security implications documented
- [ ] Follows existing code style

### Adding Dependencies

New dependencies require extra scrutiny:

1. Is it from a trusted source?
2. Is it actively maintained?
3. Does it handle any cryptographic operations? (If yes, reject)
4. Has it been audited?

### Reporting Security Issues

**DO NOT** open public issues for security vulnerabilities.

Email: security@your-org.com

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Development Setup

```bash
git clone https://github.com/your-org/solana-wallet-toolkit.git
cd solana-wallet-toolkit/mcp-server
npm install
npm run dev
```

## Running Tests

```bash
# All tests
npm test

# Specific test file
npm test -- tests/security/key-exposure.test.ts

# With coverage
npm run test:coverage
```

## Code Style

- TypeScript strict mode
- ESLint + Prettier
- Meaningful variable names
- Comments for complex logic

## Commit Messages

Follow conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `security:` Security-related change
- `docs:` Documentation
- `test:` Test changes
- `chore:` Maintenance

Example: `feat: add timeout parameter to vanity generation`
```

---

## Final Checklist

Before considering documentation complete:

- [ ] README is comprehensive and accurate
- [ ] Claude Desktop config examples work
- [ ] API documentation matches implementation
- [ ] All examples are tested
- [ ] Changelog is up to date
- [ ] Contributing guide is clear
- [ ] Deployment scripts work
- [ ] CI/CD pipeline configured

---

## Success Criteria

1. ✅ Complete README with installation and usage
2. ✅ Claude Desktop configuration examples
3. ✅ API documentation for all methods
4. ✅ Usage examples with conversations
5. ✅ Docker support
6. ✅ CI/CD workflow
7. ✅ Publishing scripts
8. ✅ Contributing guide

---

## Handoff: Project Complete

With all 5 agents' work combined:

1. **Agent 1**: Server core and transport ✅
2. **Agent 2**: Tools and prompts ✅
3. **Agent 3**: Resources and sampling ✅
4. **Agent 4**: Testing and security ✅
5. **Agent 5**: Documentation and deployment ✅

The MCP server is ready for production use!
