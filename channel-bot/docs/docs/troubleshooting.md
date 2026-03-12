# Troubleshooting

> Common issues and solutions for PumpKit bots. Can't find your answer? [Open a discussion](https://github.com/nirholas/pumpkit/discussions).

---

## Installation Issues

### `Cannot find module '@pumpkit/core'`

Make sure you're in the monorepo root and have installed dependencies:

```bash
cd pumpkit
npm install
```

If running a specific package, use the workspace flag:

```bash
npm run dev --workspace=@pumpkit/monitor
```

### TypeScript compilation errors

```bash
npm run build
```

If errors persist, clean and rebuild:

```bash
rm -rf packages/*/dist
npm run build
```

---

## Telegram Bot Issues

### Bot not responding to commands

1. **Check bot token** — Verify `TELEGRAM_BOT_TOKEN` in `.env` matches [@BotFather](https://t.me/BotFather)
2. **Check polling vs webhook** — grammy defaults to long polling. If deploying behind a reverse proxy, configure webhooks
3. **Check bot permissions** — For channel bots, the bot must be added as an admin
4. **Check logs** — Look for grammy errors in stdout

```bash
# Run locally with verbose logging
LOG_LEVEL=debug npm run dev --workspace=@pumpkit/monitor
```

### Channel bot not posting

- The bot must be a **channel administrator** with "Post Messages" permission
- `TELEGRAM_CHANNEL_ID` must include the `-100` prefix for supergroups: `-1001234567890`
- Test with a direct message first to confirm the bot is alive

### Rate limiting from Telegram

Telegram limits bots to ~30 messages/second. If you're posting claim alerts for high-volume tokens:

- Batch messages with a queue
- Use `parse_mode: "HTML"` to combine multiple alerts into one message
- Consider a minimum claim threshold to filter noise

### Grammy `GrammyError: Call to 'sendMessage' failed`

Common causes:
- Bot was removed from the group/channel
- Message too long (Telegram limit: 4096 chars)
- Invalid HTML formatting (unclosed tags)
- Bot blocked by user (for DM bots)

---

## Solana RPC Issues

### `Error: 429 Too Many Requests`

You're hitting RPC rate limits:

1. Use a dedicated RPC provider (Helius, QuickNode, Triton)
2. Batch requests with `getMultipleAccountsInfo`
3. Add retry logic with exponential backoff

```typescript
const [acctA, acctB] = await connection.getMultipleAccountsInfo([pdaA, pdaB]);
```

### `Error: failed to get info about account`

- The bonding curve may not exist yet (token not created)
- The mint address may be wrong
- The token may have graduated and the account closed

### WebSocket connection drops

Solana RPC WebSockets can be unstable. PumpKit bots should:

- Auto-reconnect on disconnect (monitor bot does this)
- Use `onLogs` with a confirmed commitment level
- Have a fallback HTTP polling mode

---

## Railway Deployment Issues

### Build fails on Railway

- Ensure `Dockerfile` is in the package root
- Check that `tsconfig.json` `outDir` matches the Dockerfile `CMD` path
- Verify all env vars are set in Railway dashboard

### Bot crashes with `ENOMEM`

Railway Hobby plan has 512MB RAM. Solutions:

- Use `--max-old-space-size=384` in your start command
- Reduce concurrent RPC connections
- Use SQLite instead of in-memory stores for large datasets

### Health check fails

Railway expects an HTTP health endpoint. PumpKit core provides one:

```typescript
import { startHealthServer } from '@pumpkit/core';

startHealthServer({ port: parseInt(process.env.PORT || '3000') });
```

---

## Claim Detection Issues

### Claims not being detected

1. **Check program IDs** — Ensure you're monitoring all 3 Pump programs:
   - Pump: `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`
   - PumpAMM: `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA`
   - PumpFees: `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ`
2. **Check event parsing** — Log raw transaction data to verify events are being decoded
3. **Check RPC commitment** — Use `confirmed` or `finalized`, not `processed`

### Wrong token displayed for claim

One social fee PDA can be a shareholder in multiple `SharingConfig` accounts (one per token). The `SocialFeeIndex` maps PDA → Set of mints. When multiple mints match:

- All candidate mints are fetched
- The highest market cap token is displayed as primary
- All linked tokens are shown in the message

### First-claim detection resets after redeploy

Local state is lost on redeploy. Solutions:

- Persist claim state to disk (PumpKit uses JSON files in `/data/`)
- Cross-check with on-chain lifetime data via `getCreatorVaultBalanceBothPrograms`
- Use the `-1` sentinel value for ambiguous first claims

---

## Still Stuck?

1. Check [FAQ](./faq.md) for quick answers
2. Check [Error Reference](./errors.md) for specific error codes
3. [Open a discussion](https://github.com/nirholas/pumpkit/discussions) on GitHub
4. Review [RPC Best Practices](./rpc-best-practices.md) for connection issues
