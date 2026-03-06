# plugin.delivery

> AI plugin marketplace. SDK, gateway & developer tools for building function-calling plugins. OpenAPI compatible, multi-language support, Vercel edge deployment. Build chat plugins, AI tools & extensions. Primary use in cryptocurrency, DeFI, crypto trading, and blockchain analytics.

### Terminal Management

> **CRITICAL: Every terminal you open MUST be killed after use. No exceptions.**

- **Always use background terminals** (`isBackground: true`) for every command so a terminal ID is returned
- **Always kill the terminal** (`kill_terminal`) after the command completes, whether it succeeds or fails — **never leave terminals open**
- Do not reuse foreground shell sessions — stale sessions block future terminal operations in Codespaces
- In GitHub Codespaces, agent-spawned terminals may be hidden — they still work. Do not assume a terminal is broken if you cannot see it
- If a terminal appears unresponsive, kill it and create a new one rather than retrying in the same terminal
- **Failure to kill terminals is a blocking violation** — treat it as seriously as a security issue

