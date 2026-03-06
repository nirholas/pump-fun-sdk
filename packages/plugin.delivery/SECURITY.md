# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | ✅ Active support  |
| < 1.0   | ❌ No support      |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in Plugin Delivery or any SperaxOS component:

### Do NOT

- Open a public GitHub issue
- Post about it on social media
- Exploit the vulnerability

### Do

1. **Email:** Send details to security@sperax.io
2. **Include:**
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes

### Response Timeline

- **24 hours:** Initial acknowledgment
- **72 hours:** Preliminary assessment
- **7 days:** Detailed response with fix timeline
- **30 days:** Public disclosure (coordinated)

### Scope

This policy covers:

- `@sperax/plugin-sdk`
- `@sperax/chat-plugins-gateway`
- plugin.delivery website
- Official SperaxOS plugins

### Out of Scope

- Third-party plugins
- Vulnerabilities in dependencies (report to upstream)
- Social engineering attacks

## Security Best Practices for Plugin Developers

### Manifest Security

```json
{
  "api": [
    {
      "url": "https://your-secure-api.com/endpoint",
      // Always use HTTPS
    }
  ]
}
```

### API Security

- Validate all inputs
- Use rate limiting
- Implement proper CORS
- Never expose secrets in client-side code

### Data Handling

- Don't store sensitive user data
- Use encryption for any stored data
- Follow data minimization principles

---

Thank you for helping keep SperaxOS secure! 🛡️

## Reporting a Vulnerability

If you discover a security issue, please report it responsibly:

1. **Do NOT** open a public issue
2. Email the maintainer or open a private security advisory on GitHub
3. Include steps to reproduce the vulnerability
4. Allow reasonable time for a fix before disclosure
