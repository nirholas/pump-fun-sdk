# Agent 4: MCP Testing & Security Audit

## Role
You are a Claude Opus 4.5 agent responsible for comprehensive testing and security auditing of the MCP server. Your work ensures the server is production-ready and secure for handling cryptocurrency keys.

## Context
Agents 1-3 have built the complete MCP server. You must thoroughly test all functionality and verify no security vulnerabilities exist. **This is a cryptocurrency application - security failures could result in financial loss.**

---

## Your Deliverables

### 1. Test Framework Setup

**tests/setup.ts**:
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

export interface TestContext {
  server: Server;
  client: Client;
  cleanup: () => Promise<void>;
}

export async function createTestContext(): Promise<TestContext> {
  // Create in-memory transport pair
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  // Import and create server
  const { SolanaWalletMCPServer } = await import('../src/server.js');
  const mcpServer = new SolanaWalletMCPServer();

  // Get the internal server instance
  const server = (mcpServer as any).server as Server;

  // Create client
  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: {} }
  );

  // Connect both
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return {
    server,
    client,
    cleanup: async () => {
      await mcpServer.shutdown();
      await client.close();
    },
  };
}

// Helper to call tools
export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown> = {}
): Promise<{ content: Array<{ type: string; text?: string }>; isError?: boolean }> {
  const result = await client.request(
    {
      method: 'tools/call',
      params: { name, arguments: args },
    },
    { method: 'tools/call' } as any
  );
  return result as any;
}

// Helper to read resources
export async function readResource(
  client: Client,
  uri: string
): Promise<{ contents: Array<{ uri: string; text?: string }> }> {
  const result = await client.request(
    {
      method: 'resources/read',
      params: { uri },
    },
    { method: 'resources/read' } as any
  );
  return result as any;
}
```

---

### 2. Unit Tests

**tests/unit/tools.test.ts**:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, callTool, TestContext } from '../setup.js';

describe('MCP Tools', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('generate_keypair', () => {
    it('should generate a valid keypair', async () => {
      const result = await callTool(ctx.client, 'generate_keypair');
      
      expect(result.isError).toBeFalsy();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain('Public Key:');
      expect(result.content[0].text).toContain('Secret Key');
    });

    it('should save keypair when saveId provided', async () => {
      const result = await callTool(ctx.client, 'generate_keypair', {
        saveId: 'test-key-1',
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('saved as "test-key-1"');
    });

    it('should generate unique keypairs', async () => {
      const result1 = await callTool(ctx.client, 'generate_keypair');
      const result2 = await callTool(ctx.client, 'generate_keypair');

      const pubKey1 = result1.content[0].text!.match(/Public Key: (\w+)/)?.[1];
      const pubKey2 = result2.content[0].text!.match(/Public Key: (\w+)/)?.[1];

      expect(pubKey1).not.toEqual(pubKey2);
    });
  });

  describe('generate_vanity', () => {
    it('should find prefix match', async () => {
      const result = await callTool(ctx.client, 'generate_vanity', {
        prefix: 'a',
        timeout: 30,
      });

      expect(result.isError).toBeFalsy();
      
      const pubKey = result.content[0].text!.match(/Public Key: (\w+)/)?.[1];
      expect(pubKey?.toLowerCase().startsWith('a')).toBe(true);
    });

    it('should find suffix match', async () => {
      const result = await callTool(ctx.client, 'generate_vanity', {
        suffix: 'z',
        timeout: 30,
        caseInsensitive: true,
      });

      expect(result.isError).toBeFalsy();
      
      const pubKey = result.content[0].text!.match(/Public Key: (\w+)/)?.[1];
      expect(pubKey?.toLowerCase().endsWith('z')).toBe(true);
    });

    it('should reject invalid prefix characters', async () => {
      const result = await callTool(ctx.client, 'generate_vanity', {
        prefix: '0OIl', // Invalid Base58 characters
      });

      expect(result.isError).toBe(true);
    });

    it('should timeout gracefully', async () => {
      const result = await callTool(ctx.client, 'generate_vanity', {
        prefix: 'ZZZZZ', // Very unlikely
        timeout: 1,
      });

      expect(result.content[0].text).toContain('Timeout');
    });
  });

  describe('sign_message', () => {
    it('should sign with saved keypair', async () => {
      // First generate and save a keypair
      await callTool(ctx.client, 'generate_keypair', { saveId: 'sign-test' });

      const result = await callTool(ctx.client, 'sign_message', {
        message: 'Hello, Solana!',
        keypairId: 'sign-test',
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Signature');
    });

    it('should reject missing keypair', async () => {
      const result = await callTool(ctx.client, 'sign_message', {
        message: 'Test',
        keypairId: 'nonexistent',
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('verify_signature', () => {
    it('should verify valid signature', async () => {
      // Generate keypair
      const genResult = await callTool(ctx.client, 'generate_keypair', {
        saveId: 'verify-test',
      });
      const pubKey = genResult.content[0].text!.match(/Public Key: (\w+)/)?.[1]!;

      // Sign message
      const signResult = await callTool(ctx.client, 'sign_message', {
        message: 'Verify me',
        keypairId: 'verify-test',
      });
      const signature = signResult.content[0].text!.match(
        /Signature \(Base58\): (\w+)/
      )?.[1]!;

      // Verify
      const verifyResult = await callTool(ctx.client, 'verify_signature', {
        message: 'Verify me',
        signature,
        publicKey: pubKey,
      });

      expect(verifyResult.isError).toBeFalsy();
      expect(verifyResult.content[0].text).toContain('VALID');
    });

    it('should reject invalid signature', async () => {
      const result = await callTool(ctx.client, 'verify_signature', {
        message: 'Test',
        signature: 'invalidsignature123456789012345678901234567890123456789012345678901234567890',
        publicKey: '11111111111111111111111111111111',
      });

      // Should either error or say invalid
      const text = result.content[0].text!;
      expect(text.includes('INVALID') || result.isError).toBe(true);
    });
  });

  describe('validate_address', () => {
    it('should validate correct address', async () => {
      const result = await callTool(ctx.client, 'validate_address', {
        address: '11111111111111111111111111111111',
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Valid');
    });

    it('should reject address with invalid chars', async () => {
      const result = await callTool(ctx.client, 'validate_address', {
        address: '0OIl1111111111111111111111111111', // 0, O, I, l are invalid
      });

      expect(result.content[0].text).toContain('Invalid');
    });

    it('should reject wrong length', async () => {
      const result = await callTool(ctx.client, 'validate_address', {
        address: 'tooshort',
      });

      expect(result.content[0].text).toContain('Invalid');
    });
  });

  describe('estimate_vanity_time', () => {
    it('should estimate time for prefix', async () => {
      const result = await callTool(ctx.client, 'estimate_vanity_time', {
        prefix: 'abc',
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('attempts');
    });

    it('should show faster estimates for case-insensitive', async () => {
      const sensitive = await callTool(ctx.client, 'estimate_vanity_time', {
        prefix: 'ABC',
        caseInsensitive: false,
      });

      const insensitive = await callTool(ctx.client, 'estimate_vanity_time', {
        prefix: 'ABC',
        caseInsensitive: true,
      });

      // Case insensitive should show fewer attempts
      const sensitiveAttempts = parseInt(
        sensitive.content[0].text!.match(/(\d[\d,]*) attempts/)?.[1]?.replace(/,/g, '') || '0'
      );
      const insensitiveAttempts = parseInt(
        insensitive.content[0].text!.match(/(\d[\d,]*) attempts/)?.[1]?.replace(/,/g, '') || '0'
      );

      expect(insensitiveAttempts).toBeLessThan(sensitiveAttempts);
    });
  });
});
```

---

### 3. Integration Tests

**tests/integration/resources.test.ts**:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, callTool, readResource, TestContext } from '../setup.js';

describe('MCP Resources', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('config resource', () => {
    it('should return server configuration', async () => {
      const result = await readResource(ctx.client, 'solana://config');

      expect(result.contents).toHaveLength(1);
      const config = JSON.parse(result.contents[0].text!);

      expect(config.version).toBeDefined();
      expect(config.capabilities.tools).toContain('generate_keypair');
      expect(config.security.privateKeyExposure).toBe('never');
    });
  });

  describe('keypair resource', () => {
    it('should return keypair info after generation', async () => {
      await callTool(ctx.client, 'generate_keypair', { saveId: 'resource-test' });

      const result = await readResource(ctx.client, 'solana://keypair/resource-test');

      const keypairInfo = JSON.parse(result.contents[0].text!);
      expect(keypairInfo.id).toBe('resource-test');
      expect(keypairInfo.publicKey).toBeDefined();
      expect(keypairInfo.hasPrivateKey).toBe(true);
      
      // CRITICAL: Private key must NOT be in resource
      expect(keypairInfo.secretKey).toBeUndefined();
      expect(keypairInfo.privateKey).toBeUndefined();
    });

    it('should return error for nonexistent keypair', async () => {
      const result = await readResource(ctx.client, 'solana://keypair/nonexistent');

      const response = JSON.parse(result.contents[0].text!);
      expect(response.error).toBe('Keypair not found');
    });
  });

  describe('address resource', () => {
    it('should validate and return address info', async () => {
      const result = await readResource(
        ctx.client,
        'solana://address/11111111111111111111111111111111'
      );

      const addressInfo = JSON.parse(result.contents[0].text!);
      expect(addressInfo.valid).toBe(true);
      expect(addressInfo.address).toBe('11111111111111111111111111111111');
    });

    it('should mark invalid addresses', async () => {
      const result = await readResource(ctx.client, 'solana://address/invalid');

      const addressInfo = JSON.parse(result.contents[0].text!);
      expect(addressInfo.valid).toBe(false);
    });
  });
});
```

---

### 4. Security Tests

**tests/security/key-exposure.test.ts**:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, callTool, readResource, TestContext } from '../setup.js';

describe('Security: Key Exposure Prevention', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it('should never expose private keys in resource responses', async () => {
    await callTool(ctx.client, 'generate_keypair', { saveId: 'security-test' });

    const result = await readResource(ctx.client, 'solana://keypair/security-test');
    const text = result.contents[0].text!;

    // Check the JSON doesn't contain private key fields
    const parsed = JSON.parse(text);
    expect(parsed).not.toHaveProperty('secretKey');
    expect(parsed).not.toHaveProperty('privateKey');
    expect(parsed).not.toHaveProperty('secret');
    
    // Also check raw text doesn't leak key material
    expect(text.length).toBeLessThan(1000); // Private keys would make it much longer
  });

  it('should not leak keys in error messages', async () => {
    // Try to cause an error
    const result = await callTool(ctx.client, 'sign_message', {
      message: 'test',
      privateKey: 'definitely_invalid_key_here',
    });

    const text = result.content[0].text!;
    // Error should not echo back the invalid key
    expect(text).not.toContain('definitely_invalid_key_here');
  });

  it('should generate cryptographically secure random keys', async () => {
    const keys: string[] = [];
    
    // Generate 10 keypairs
    for (let i = 0; i < 10; i++) {
      const result = await callTool(ctx.client, 'generate_keypair');
      const pubKey = result.content[0].text!.match(/Public Key: (\w+)/)?.[1]!;
      keys.push(pubKey);
    }

    // All should be unique
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(10);

    // Keys should be 44 characters (standard Solana address)
    for (const key of keys) {
      expect(key.length).toBe(44);
    }
  });
});
```

**tests/security/input-validation.test.ts**:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, callTool, TestContext } from '../setup.js';

describe('Security: Input Validation', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('Prefix/Suffix Validation', () => {
    const maliciousInputs = [
      { name: 'SQL injection', value: "'; DROP TABLE users;--" },
      { name: 'Command injection', value: '$(rm -rf /)' },
      { name: 'Path traversal', value: '../../../etc/passwd' },
      { name: 'XSS attempt', value: '<script>alert(1)</script>' },
      { name: 'Null bytes', value: 'abc\x00def' },
      { name: 'Unicode exploit', value: 'a\u202Eb' }, // Right-to-left override
      { name: 'Very long string', value: 'a'.repeat(1000) },
      { name: 'Empty string', value: '' },
      { name: 'Whitespace only', value: '   ' },
      { name: 'Invalid Base58 (0)', value: '0abc' },
      { name: 'Invalid Base58 (O)', value: 'Oabc' },
      { name: 'Invalid Base58 (I)', value: 'Iabc' },
      { name: 'Invalid Base58 (l)', value: 'labc' },
    ];

    for (const { name, value } of maliciousInputs) {
      it(`should reject malicious prefix: ${name}`, async () => {
        const result = await callTool(ctx.client, 'generate_vanity', {
          prefix: value,
          timeout: 1,
        });

        // Should either error or timeout without executing malicious code
        const isHandled =
          result.isError || result.content[0].text!.includes('Timeout');
        expect(isHandled).toBe(true);
      });
    }
  });

  describe('Address Validation', () => {
    const maliciousAddresses = [
      { name: 'SQL injection', value: "1' OR '1'='1" },
      { name: 'Too short', value: 'abc' },
      { name: 'Too long', value: 'a'.repeat(100) },
      { name: 'Invalid chars', value: '0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O' },
    ];

    for (const { name, value } of maliciousAddresses) {
      it(`should reject malicious address: ${name}`, async () => {
        const result = await callTool(ctx.client, 'validate_address', {
          address: value,
        });

        expect(result.content[0].text).toContain('Invalid');
      });
    }
  });

  describe('URI Validation', () => {
    it('should reject non-solana protocol', async () => {
      const result = await readResource(ctx.client, 'file:///etc/passwd');
      expect(result.contents[0].text).toContain('Unsupported');
    });

    it('should handle URI path traversal attempts', async () => {
      const result = await readResource(
        ctx.client,
        'solana://keypair/../../../etc/passwd'
      );
      // Should either error or handle gracefully
      expect(result.contents).toBeDefined();
    });
  });
});

async function readResource(client: any, uri: string) {
  const result = await client.request(
    { method: 'resources/read', params: { uri } },
    { method: 'resources/read' }
  );
  return result;
}
```

---

### 5. E2E Tests

**tests/e2e/workflow.test.ts**:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, callTool, readResource, TestContext } from '../setup.js';

describe('E2E: Complete Workflows', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it('should complete full keypair lifecycle', async () => {
    // 1. Generate keypair
    const genResult = await callTool(ctx.client, 'generate_keypair', {
      saveId: 'lifecycle-test',
    });
    expect(genResult.isError).toBeFalsy();

    const pubKey = genResult.content[0].text!.match(/Public Key: (\w+)/)?.[1]!;
    expect(pubKey).toBeDefined();

    // 2. Validate the generated address
    const validateResult = await callTool(ctx.client, 'validate_address', {
      address: pubKey,
    });
    expect(validateResult.content[0].text).toContain('Valid');

    // 3. Sign a message
    const signResult = await callTool(ctx.client, 'sign_message', {
      message: 'E2E test message',
      keypairId: 'lifecycle-test',
    });
    expect(signResult.isError).toBeFalsy();

    const signature = signResult.content[0].text!.match(
      /Signature \(Base58\): (\w+)/
    )?.[1]!;
    expect(signature).toBeDefined();

    // 4. Verify the signature
    const verifyResult = await callTool(ctx.client, 'verify_signature', {
      message: 'E2E test message',
      signature,
      publicKey: pubKey,
    });
    expect(verifyResult.content[0].text).toContain('VALID');

    // 5. Read keypair as resource
    const resourceResult = await readResource(
      ctx.client,
      `solana://keypair/lifecycle-test`
    );
    const keypairInfo = JSON.parse(resourceResult.contents[0].text!);
    expect(keypairInfo.publicKey).toBe(pubKey);

    // 6. Verify message tampering is detected
    const tamperResult = await callTool(ctx.client, 'verify_signature', {
      message: 'TAMPERED message',
      signature,
      publicKey: pubKey,
    });
    expect(tamperResult.content[0].text).toContain('INVALID');
  });

  it('should complete vanity address workflow', async () => {
    // 1. Estimate time
    const estimateResult = await callTool(ctx.client, 'estimate_vanity_time', {
      prefix: 'a',
      caseInsensitive: true,
    });
    expect(estimateResult.content[0].text).toContain('Expected attempts');

    // 2. Generate vanity
    const vanityResult = await callTool(ctx.client, 'generate_vanity', {
      prefix: 'a',
      caseInsensitive: true,
      timeout: 30,
      saveId: 'vanity-test',
    });
    expect(vanityResult.isError).toBeFalsy();

    const pubKey = vanityResult.content[0].text!.match(/Public Key: (\w+)/)?.[1]!;
    expect(pubKey.toLowerCase().startsWith('a')).toBe(true);

    // 3. Use the vanity address for signing
    const signResult = await callTool(ctx.client, 'sign_message', {
      message: 'Vanity address test',
      keypairId: 'vanity-test',
    });
    expect(signResult.isError).toBeFalsy();
  });
});
```

---

### 6. Performance Tests

**tests/performance/benchmark.test.ts**:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, callTool, TestContext } from '../setup.js';

describe('Performance Benchmarks', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it('should generate keypairs at acceptable rate', async () => {
    const count = 50;
    const start = Date.now();

    for (let i = 0; i < count; i++) {
      await callTool(ctx.client, 'generate_keypair');
    }

    const elapsed = Date.now() - start;
    const rate = count / (elapsed / 1000);

    console.log(`Keypair generation rate: ${rate.toFixed(2)} keys/sec`);
    expect(rate).toBeGreaterThan(10); // At least 10 keys/sec
  });

  it('should respond to validation quickly', async () => {
    const start = Date.now();

    for (let i = 0; i < 100; i++) {
      await callTool(ctx.client, 'validate_address', {
        address: '11111111111111111111111111111111',
      });
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000); // 100 validations in < 5 seconds
  });

  it('should find 1-char vanity in reasonable time', async () => {
    const start = Date.now();

    const result = await callTool(ctx.client, 'generate_vanity', {
      prefix: 'a',
      timeout: 10,
    });

    const elapsed = Date.now() - start;
    
    expect(result.isError).toBeFalsy();
    expect(elapsed).toBeLessThan(5000); // Should find 'a' prefix quickly
  });
});
```

---

### 7. Security Audit Checklist

**security/MCP_SECURITY_AUDIT.md**:
```markdown
# MCP Server Security Audit

## Date: [DATE]
## Auditor: Agent 4
## Version: 1.0.0

---

## 1. Key Material Security

### 1.1 Private Key Handling
- [ ] Private keys are NEVER logged
- [ ] Private keys are NEVER in error messages
- [ ] Private keys are NEVER in resource responses
- [ ] Private keys are zeroized on shutdown
- [ ] Private keys exist only in memory (not persisted)

### 1.2 Key Generation
- [ ] Uses official @solana/web3.js Keypair.generate()
- [ ] No custom PRNG implementation
- [ ] Entropy source is cryptographically secure

---

## 2. Input Validation

### 2.1 Tool Inputs
- [ ] All inputs validated with Zod schemas
- [ ] Base58 character validation
- [ ] Length limits enforced
- [ ] Type coercion handled safely

### 2.2 URI Handling
- [ ] Only `solana:` protocol accepted
- [ ] Path traversal prevented
- [ ] Resource IDs sanitized

### 2.3 Injection Prevention
- [ ] SQL injection: N/A (no database)
- [ ] Command injection: Prevented (no shell execution)
- [ ] XSS: Prevented (text-only responses)

---

## 3. Protocol Security

### 3.1 MCP Compliance
- [ ] Protocol version negotiated correctly
- [ ] Capabilities advertised accurately
- [ ] Error responses don't leak information

### 3.2 Transport Security
- [ ] Stdio transport secure by default
- [ ] No sensitive data in transport headers

---

## 4. Dependencies

### 4.1 Allowed Dependencies
- [ ] @modelcontextprotocol/sdk - Official MCP SDK
- [ ] @solana/web3.js - Official Solana SDK
- [ ] zod - Schema validation (no security implications)
- [ ] typescript - Development only

### 4.2 Dependency Audit
- [ ] `npm audit` returns no critical vulnerabilities
- [ ] No known CVEs in dependencies
- [ ] Dependencies are up to date

---

## 5. Error Handling

### 5.1 Safe Error Messages
- [ ] Errors don't expose stack traces
- [ ] Errors don't expose file paths
- [ ] Errors don't expose private keys
- [ ] Errors are user-friendly

---

## 6. Test Coverage

### 6.1 Coverage Metrics
- Unit tests: XX%
- Integration tests: XX%
- Security tests: XX%

### 6.2 Edge Cases Tested
- [ ] Empty inputs
- [ ] Maximum length inputs
- [ ] Invalid characters
- [ ] Timeout scenarios
- [ ] Memory pressure

---

## 7. Findings

### Critical
[None found / List issues]

### High
[None found / List issues]

### Medium
[None found / List issues]

### Low
[None found / List issues]

---

## 8. Recommendations

1. [Recommendation 1]
2. [Recommendation 2]

---

## 9. Sign-off

- [ ] All critical issues resolved
- [ ] All high issues resolved
- [ ] Medium/Low issues documented with mitigation plan
- [ ] Ready for production

Signed: _______________________
Date: _______________________
```

---

## Running Tests

```bash
# Install dependencies
cd mcp-server && npm install

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/security/key-exposure.test.ts

# Run security audit
npm audit
```

---

## Success Criteria

1. ✅ All unit tests pass
2. ✅ All integration tests pass
3. ✅ All security tests pass
4. ✅ All E2E tests pass
5. ✅ Performance meets thresholds
6. ✅ Security audit checklist complete
7. ✅ No critical/high vulnerabilities
8. ✅ Tests pass 10+ consecutive runs

---

## Handoff Notes

**For Agent 5 (Docs & Deploy)**:
- Test results summary
- Security audit report
- Coverage report location
- Known issues/limitations
