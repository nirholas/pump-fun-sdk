# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.x.x (current) | :white_check_mark: Active development |

## Reporting a Vulnerability

**Do NOT report security vulnerabilities through public GitHub issues.**

Instead, please open a [private security advisory](https://github.com/nirholas/pumpkit/security/advisories/new) on GitHub.

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Affected package(s) and version(s)
- Potential impact assessment
- Suggested fix (if you have one)

### Response Timeline

| Stage | Expected Time |
|-------|---------------|
| Acknowledgment | Within 48 hours |
| Initial assessment | Within 1 week |
| Patch development | Varies by severity |
| Public disclosure | After fix is released |

We follow [responsible disclosure](https://en.wikipedia.org/wiki/Responsible_disclosure) and will credit reporters in the changelog unless you prefer anonymity.

## Scope

### In Scope

- Vulnerabilities in any `@pumpkit/*` package code
- Solana RPC data handling (malicious RPC responses)
- Telegram bot token exposure risks
- Private key exposure in logs, messages, or storage
- SQL injection in SQLite queries (`@pumpkit/tracker`)
- Message formatting injection (HTML/Telegram)
- Dependency vulnerabilities in production packages
- Docker image security (exposed ports, secrets in layers)

### Out of Scope

- Pump.fun on-chain program vulnerabilities (report to Pump.fun directly)
- Telegram API vulnerabilities (report to Telegram)
- grammy framework vulnerabilities (report upstream)
- Social engineering attacks
- Denial of service against RPC endpoints

## Security Practices

### Bot Token Handling

- Bot tokens are loaded from environment variables only — never hardcoded
- Tokens are never logged or included in error messages
- Each bot (monitor, tracker, channel, claim) uses a separate token

### Solana RPC

- No private keys are handled by PumpKit bots — they are read-only monitors
- RPC URLs support fallback rotation for reliability
- WebSocket URLs are derived from RPC URLs when not explicitly set

### Database Security (`@pumpkit/tracker`)

- SQLite with parameterized queries — no string concatenation for SQL
- Database file stored locally with restricted permissions
- No sensitive data (keys, tokens) stored in the database

### Message Security

- All Telegram messages use HTML parse mode with proper escaping
- User-provided input (wallet addresses, token names) is sanitized before display
- No arbitrary code execution from message content

### Docker

- Multi-stage builds to minimize image size and attack surface
- Non-root user in production containers
- No secrets baked into Docker layers — use environment variables at runtime
