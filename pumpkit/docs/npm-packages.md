# NPM Packages

> 🚧 **Coming Soon** — PumpKit packages will be published to npm under the `@pumpkit` scope.

## Planned Packages

| Package | npm | Description |
|---------|-----|-------------|
| `@pumpkit/core` | `npm i @pumpkit/core` | Shared framework — bot scaffolding, Solana monitoring, formatters, storage, config, health |
| `@pumpkit/monitor` | `npm i @pumpkit/monitor` | All-in-one PumpFun monitor bot (claims, launches, graduations, whales, CTO alerts) |
| `@pumpkit/tracker` | `npm i @pumpkit/tracker` | Group call-tracking bot with leaderboards, PNL cards, rankings |

## Installation (planned)

```bash
# Install the core framework
npm install @pumpkit/core

# Or install a complete bot
npm install @pumpkit/monitor
```

## Usage (planned)

### Use core framework to build a custom bot

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

### Use pre-built bot programmatically

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

## Version Policy

- **Core**: Semantic versioning. Breaking changes in major versions only.
- **Bots**: Follow core version. `@pumpkit/monitor@1.x` requires `@pumpkit/core@1.x`.

## Publishing Timeline

1. ✅ Framework design and documentation complete
2. 🚧 Core implementation in progress
3. ⏳ Beta packages with `@next` tag
4. ⏳ Stable `@latest` release

Watch the [GitHub repo](https://github.com/nirholas/pumpkit) for release announcements.
