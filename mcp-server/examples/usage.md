# MCP Server Usage Examples

## Tool Usage

### Generate a Keypair

```json
{
  "method": "tools/call",
  "params": {
    "name": "generate_keypair",
    "arguments": {
      "saveId": "my-wallet"
    }
  }
}
```

### Generate a Vanity Address

```json
{
  "method": "tools/call",
  "params": {
    "name": "generate_vanity",
    "arguments": {
      "prefix": "SOL",
      "caseInsensitive": true,
      "timeout": 120
    }
  }
}
```

### Sign a Message

```json
{
  "method": "tools/call",
  "params": {
    "name": "sign_message",
    "arguments": {
      "message": "Hello, Solana!",
      "keypairId": "my-wallet"
    }
  }
}
```

### Verify a Signature

```json
{
  "method": "tools/call",
  "params": {
    "name": "verify_signature",
    "arguments": {
      "message": "Hello, Solana!",
      "signature": "<base58-signature>",
      "publicKey": "<base58-public-key>"
    }
  }
}
```

### Validate an Address

```json
{
  "method": "tools/call",
  "params": {
    "name": "validate_address",
    "arguments": {
      "address": "11111111111111111111111111111111"
    }
  }
}
```

### Estimate Vanity Time

```json
{
  "method": "tools/call",
  "params": {
    "name": "estimate_vanity_time",
    "arguments": {
      "prefix": "SOL",
      "caseInsensitive": true
    }
  }
}
```

### Restore a Keypair

```json
{
  "method": "tools/call",
  "params": {
    "name": "restore_keypair",
    "arguments": {
      "seedPhrase": "word1 word2 ... word12",
      "saveId": "restored-wallet"
    }
  }
}
```

## Resource Access

### Get Server Configuration

```json
{
  "method": "resources/read",
  "params": {
    "uri": "solana://config"
  }
}
```

### Get Keypair Info

```json
{
  "method": "resources/read",
  "params": {
    "uri": "solana://keypair/my-wallet"
  }
}
```

## Prompt Usage

### Create Wallet Prompt

```json
{
  "method": "prompts/get",
  "params": {
    "name": "create_wallet",
    "arguments": {
      "type": "vanity"
    }
  }
}
```

### Security Audit Prompt

```json
{
  "method": "prompts/get",
  "params": {
    "name": "security_audit"
  }
}
```

### Batch Generate Prompt

```json
{
  "method": "prompts/get",
  "params": {
    "name": "batch_generate",
    "arguments": {
      "count": "5"
    }
  }
}
```

## Testing the Server

You can test the server using stdin/stdout:

```bash
# Build the server
npm run build

# Test initialize
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node dist/index.js

# List tools
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | node dist/index.js
```
