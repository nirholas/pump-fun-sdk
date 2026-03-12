# npm Packages

PumpKit packages are available under the `@pumpkit` scope. Currently distributed via the monorepo — install from source using workspace references.

## Packages

| Package | Install | Description | Status |
|---------|---------|-------------|--------|
| `@pumpkit/core` | `npm i @pumpkit/core` | Shared framework — bot scaffolding, Solana monitoring, formatters, storage, config, health | ✅ Ready |
| `@pumpkit/monitor` | `npm i @pumpkit/monitor` | All-in-one PumpFun monitor bot (claims, launches, graduations, whales, CTO alerts) | ✅ Ready |
| `@pumpkit/channel` | `npm i @pumpkit/channel` | Read-only Telegram channel feed (broadcasts token events) | ✅ Ready |
| `@pumpkit/claim` | `npm i @pumpkit/claim` | Fee claim tracker by token CA or X handle | ✅ Ready |
| `@pumpkit/tracker` | `npm i @pumpkit/tracker` | Group call-tracking bot with leaderboards and PNL cards | ✅ Ready |

## Install

Once published to npm, install packages directly:

```bash
# Install the core framework
npm install @pumpkit/core

# Install a specific bot
npm install @pumpkit/monitor

# Install everything
npm install @pumpkit/core @pumpkit/monitor @pumpkit/tracker @pumpkit/channel @pumpkit/claim
```

## Usage

### Build a custom bot with core

```typescript
import { createBot, ClaimMonitor, formatClaim, createHealthServer } from '@pumpkit/core';

const bot = createBot({
  token: process.env.BOT_TOKEN!,
  commands: {
    start: (ctx) => ctx.reply('Welcome!'),
  },
});

const monitor = new ClaimMonitor({
  rpcUrl: process.env.SOLANA_RPC_URL!,
  onClaim: async (event) => {
    await bot.broadcast(formatClaim(event));
  },
});

createHealthServer({ port: 3000, monitor });
monitor.start();
bot.launch();
```

### Use a pre-built bot programmatically

```typescript
import { MonitorBot } from '@pumpkit/monitor';

const bot = new MonitorBot({
  telegramToken: process.env.BOT_TOKEN!,
  solanaRpcUrl: process.env.SOLANA_RPC_URL!,
  channelId: process.env.CHANNEL_ID!,
  feeds: {
    claims: true,
    launches: true,
    graduations: true,
    whales: true,
  },
});

await bot.start();
```

## Current Usage (Monorepo)

For now, clone the repo and use workspace references:

```bash
git clone https://github.com/nirholas/pumpkit.git
cd pumpkit
npm install

# Run a bot
npm run dev --workspace=@pumpkit/monitor

# Build all packages
npm run build
```

## Workspace References

Within the monorepo, packages reference each other via workspace protocol:

```json
{
  "dependencies": {
    "@pumpkit/core": "workspace:*"
  }
}
```

## Publishing Checklist

Before publishing to npm, we'll ensure:

- [ ] All packages compile cleanly with `tsc`
- [ ] Barrel exports (`index.ts`) expose stable public API
- [ ] `package.json` has correct `exports`, `main`, `types` fields
- [ ] `.npmignore` or `files` field limits published content
- [ ] `README.md` per package with install + usage instructions
- [ ] `CHANGELOG.md` per package
- [ ] CI pipeline runs tests before publish
- [ ] Scoped under `@pumpkit` npm organization

## Version Strategy

We'll follow [Semantic Versioning](https://semver.org/):

- **0.x.x** — Initial development (breaking changes allowed)
- **1.0.0** — First stable release
- All packages will be versioned independently
- **Core** follows semver strictly. Breaking changes in major versions only.
- **Bots** follow core version. `@pumpkit/monitor@1.x` requires `@pumpkit/core@1.x`.

## Roadmap to First Publish

1. ✅ Framework design and documentation complete
2. ✅ Core implementation complete
3. ✅ Bot packages implemented (monitor, channel, claim, tracker)
4. 🚧 Stabilize barrel exports and public API surface
5. ⏳ Add tests — unit tests for core, integration tests for bots
6. ⏳ Automate release — GitHub Actions workflow for `npm publish`
7. ⏳ Publish `0.1.0` — Initial release to npm under `@pumpkit` scope

### What You Can Do Now

```bash
# Clone and use locally — everything works via workspace references
git clone https://github.com/nirholas/pumpkit.git
cd pumpkit
npm install
npm run dev --workspace=@pumpkit/monitor
```

### What Will Change With npm

```bash
# Instead of cloning the whole repo, just install what you need
mkdir my-bot && cd my-bot
npm init -y
npm install @pumpkit/core grammy dotenv
```

No code changes needed — imports like `import { createBot } from '@pumpkit/core'` will work the same whether you're using workspace references or npm packages.

## Stay Updated

Watch the [GitHub repo](https://github.com/nirholas/pumpkit) for release announcements.
