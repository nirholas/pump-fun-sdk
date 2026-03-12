# Security Policy

## Scope

This project is a **static UI template** with no backend, no authentication, and no sensitive data handling. It contains zero JavaScript dependencies and no server-side code.

## Reporting Security Issues

If you discover a security vulnerability (e.g., XSS in the JavaScript, unsafe HTML patterns, or issues with the Vercel deployment config), please report it responsibly:

1. **DO NOT** open a public issue
2. Email the maintainer or use [GitHub Security Advisories](https://github.com/nirholas/solana-launchpad-ui/security/advisories/new)

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest `main` | ✅ |
| Older commits | ❌ |

## Security Considerations

Since this is a static template with mock data:

- **No API keys** are stored in the codebase
- **No user data** is collected or transmitted
- **No wallet connections** are made (mock UI only)
- **CSP headers** are configured in `vercel.json`
- **X-Frame-Options: DENY** prevents clickjacking
- **X-Content-Type-Options: nosniff** prevents MIME sniffing

## If You Add Real Functionality

If you fork this and add real blockchain integration:

- Never store private keys in frontend code
- Use environment variables for API keys
- Implement proper CSP headers
- Validate all user inputs
- Use established wallet adapters (Phantom, Solflare)
- Follow the [Solana Security Best Practices](https://docs.solana.com/developing/programming-model/security)
