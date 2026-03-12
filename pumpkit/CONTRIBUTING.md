# Contributing to PumpKit

Thank you for your interest in contributing to PumpKit!

## Project Structure

```
pumpkit/
├── packages/
│   ├── core/        @pumpkit/core — shared framework
│   ├── monitor/     @pumpkit/monitor — monitoring bot
│   ├── tracker/     @pumpkit/tracker — group tracker bot
│   ├── channel/     @pumpkit/channel — channel feed bot
│   ├── claim/       @pumpkit/claim — claim tracker bot
│   └── web/         @pumpkit/web — frontend dashboard and docs site
├── docs/            documentation and guides
├── tutorials/       hands-on step-by-step guides
├── examples/        HTML dashboard examples
├── agent-prompts/   sequenced implementation tasks
└── turbo.json       monorepo orchestration
```

## Getting Started

```bash
git clone https://github.com/pumpkit/pumpkit.git
cd pumpkit
npm install
```

### Development

```bash
# Run all packages in dev mode
npm run dev

# Run specific package
npm run dev --workspace=@pumpkit/monitor

# Type check all packages
npm run typecheck

# Lint
npm run lint
```

### Testing

```bash
npm test                    # All tests
npm test --workspace=@pumpkit/core   # Core only
```

## Code Style

- **TypeScript** — strict mode, ES modules
- **grammy** for Telegram bots — not Telegraf, not node-telegram-bot-api
- **HTML** for Telegram messages — not Markdown
- **BN** (bn.js) for all financial amounts — never `number`
- **Leveled logging** — use `log.info/warn/error/debug`, not `console.log`
- **Graceful shutdown** — handle SIGINT/SIGTERM in every entry point
- Follow existing patterns in the codebase

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and add tests
4. Ensure all checks pass: `npm run typecheck && npm run lint && npm test`
5. Submit a PR with a clear description

## Adding a New Monitor

If you want to add a new event monitor to `@pumpkit/core`:

1. Create `packages/core/src/monitor/YourMonitor.ts`
2. Extend `BaseMonitor`
3. Define the event type in `packages/core/src/types/events.ts`
4. Add a formatter in `packages/core/src/formatter/templates.ts`
5. Export from `packages/core/src/index.ts`
6. Add to the Monitor Bot in `packages/monitor/src/monitors/`

## Adding a New Command

To add a Telegram command to a bot:

1. Add the handler in the bot's `src/bot.ts`
2. Update the help text in `src/formatters.ts`
3. Add tests

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
