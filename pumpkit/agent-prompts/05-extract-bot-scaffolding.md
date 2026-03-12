# Agent Task 05: Extract Telegram Bot Scaffolding

## Context

We're building **PumpKit** (`/workspaces/pump-fun-sdk/pumpkit/`). Read `pumpkit/docs/core-api.md` for the bot API spec.

All 4 bots use grammy with the same setup pattern. Extract into `@pumpkit/core`.

## Source Files to Read

- `/workspaces/pump-fun-sdk/telegram-bot/src/bot.ts`
- `/workspaces/pump-fun-sdk/telegram-bot/src/index.ts`
- `/workspaces/pump-fun-sdk/channel-bot/src/index.ts`
- `/workspaces/pump-fun-sdk/claim-bot/src/bot.ts`
- `/workspaces/pump-fun-sdk/claim-bot/src/index.ts`
- `/workspaces/pump-fun-sdk/outsiders-bot/src/bot.ts`
- `/workspaces/pump-fun-sdk/outsiders-bot/src/index.ts`

## Task

Create `/workspaces/pump-fun-sdk/pumpkit/packages/core/src/bot/index.ts`:

1. Read all bot setup files to identify the shared Grammy patterns
2. Create a `createBot(options)` factory that:
   - Creates a grammy `Bot` instance
   - Registers command handlers from an options map
   - Sets up error handling (grammy `.catch()`)
   - Sets default parse mode to HTML
   - Returns the bot instance
3. Add a `broadcast(bot, chatIds, message, options?)` helper that sends to multiple chats with Telegram rate limiting (max 30 msg/sec)
4. Add graceful shutdown setup (`setupShutdown(bot, ...cleanups)`)

## API

```typescript
import { createBot, setupShutdown } from '@pumpkit/core';

const bot = createBot({
  token: process.env.TELEGRAM_BOT_TOKEN!,
  commands: {
    start: (ctx) => ctx.reply('Welcome!'),
    help: (ctx) => ctx.reply('Commands: /start, /help'),
  },
  onError: (err) => log.error('Bot error:', err),
  parseMode: 'HTML',
  adminChatIds: [123456789],
});

setupShutdown(bot, () => monitor.stop(), () => db.close());
await bot.start();
```

## Requirements

- grammy as the only Telegram dependency
- ES module syntax
- Export types for `BotOptions`, `CommandHandler`
- The `broadcast` function should respect Telegram's 30 msg/sec rate limit with simple delay

## Do NOT

- Don't install grammy (assume it's in package.json already)
- Don't modify existing bot code
- Don't add middleware beyond error handling (keep it minimal)
