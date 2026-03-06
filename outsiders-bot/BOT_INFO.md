# Outsiders Bot — Complete Information Sheet

## 📋 Bot Identity

| Field | Value |
|-------|-------|
| **Display Name** | Outsiders Bot |
| **Bot Username** | @outsidersbot (or custom if taken) |
| **About Text** | 🎯 Track crypto calls, rank performance, and compete on leaderboards. Multi-chain analytics for serious traders. |
| **Short Description** | Call tracking with leaderboards & PNL analytics |
| **Type** | Telegram Bot |
| **Purpose** | Call tracking, performance ranking, analytics |

## 📝 Full Description

```
Outsiders Bot tracks token calls across Solana, Ethereum, Base, and BSC. Get ranked by performance, compete on leaderboards, and generate PNL cards.

✨ Features:
• 📊 Real-time call tracking with ATH monitoring
• 🏆 Performance leaderboards (24h/7d/30d/all-time)
• 💰 Automatic PNL card generation
• 🎯 Points system based on multipliers
• 🏅 Win rate rankings (Amateur → Oracle)
• 🔥 Hardcore mode for serious groups
• 📢 Alpha vs Gamble call types

Paste a token CA or chart link to get started!
```

## 🎯 Bot Picture & Assets

### Profile Picture (Required)
- **Size:** 200x200px (square)
- **Format:** PNG or JPG
- **Suggested Design:** 
  - 🎯 Target with crypto theme
  - 📊 Rising chart with medals
  - 👥 Leaderboard trophy
  - 🏆 Gold trophy with coins

### Description Picture (Optional)
- **Size:** 512x256px or larger
- **Format:** PNG or JPG
- **Suggested Content:**
  - Screenshot of leaderboard in action
  - PNL card example showing winning call
  - Infographic of points system (-1 to +5)
  - Multi-chain support graphic (Solana, ETH, Base, BSC)

## 🔧 Commands

### Public Commands (Everyone)

| Command | Description | Example |
|---------|-------------|---------|
| `/start` | Welcome message | `/start` |
| `/help` | Show help menu | `/help` |
| `/leaderboard` | Show calls or performance leaderboard | `/leaderboard` |
| `/last` | Show last N calls | `/last 10` |
| `/calls` | Show user's calls | `/calls @username` |
| `/winrate` | Show user's win rate and stats | `/winrate @username` |
| `/pnl` | Generate PNL card for a token | `/pnl SolanaTokenCA` |
| `/alpha` | Make an alpha call | `/alpha SolanaTokenCA` |
| `/gamble` | Make a gamble call | `/gamble SolanaTokenCA` |
| `/rank` | Your overall rank (DM only) | `/rank` |
| `/hardcore` | Show hardcore mode status | `/hardcore` |

### Admin Commands (Group Administrators)

| Command | Description |
|---------|-------------|
| `/settings` | Configure call mode, display mode, hardcore |
| `/wipeleaderboard` | Clear all calls and reset leaderboard |
| `/block` | Reply to block a user from making calls |
| `/unblock` | Reply to unblock a user |

## 📊 Features Overview

### Call Tracking
- Paste token CA, LP link, or chart URL
- Auto-register after 30 seconds or manual confirm
- Tracks entry market cap and ATH
- Supports Solana, Ethereum, Base, BSC

### Leaderboards
- **Calls Leaderboard:** Ranked by highest multiplier
- **Performance Leaderboard:** Ranked by points and win rate
- **Timeframes:** 24h, 7d, 30d, all-time
- **User Ranks:** Amateur → Novice → Contender → Guru → Oracle

### Points System
- `-1 point` — Call < 1.5x multiplier
- `0 points` — Call 1.5x - 2.0x multiplier
- `+2 points` — Call 2x - 5x multiplier
- `+3 points` — Call 5x - 15x multiplier
- `+4 points` — Call 15x - 30x multiplier
- `+5 points` — Call 30x+ multiplier

### Win Rate
- Percentage of calls hitting ≥ 2x multiplier
- Used for user ranking and hardcore mode enforcement
- Calculated per timeframe

### PNL Cards
- Shareable images showing entry, ATH, and gain
- Canvas-based generation
- Includes user stats

### Hardcore Mode
- Auto-kick members below minimum win rate
- Configurable threshold per group
- Enforces quality of calls

## 🛡️ Privacy Policy Summary

**Short Version:**
- Stores user ID, username, group info, and call data locally
- No cloud uploads, no third-party sharing
- Data retained indefinitely unless deleted
- Admin commands control deletion
- DexScreener API fetches token prices (no PII sent)
- Full privacy policy in `PRIVACY_POLICY.md`

**Key Points:**
- ✅ Local SQLite database
- ✅ No data sold to third parties
- ✅ User data can be deleted via admin
- ✅ Leaderboards are publicly visible in groups
- ⚠️ Token data persists for leaderboard history

**For Users:**
- Use `/rank` to see your cross-group statistics
- Contact group admins to delete individual calls
- Message @OutsidersBotSupport for full account deletion
- Block the bot anytime in Telegram

**For Admins:**
- `/wipeleaderboard` clears all group data
- `/block` and `/unblock` control user access
- `/settings` configure group behavior

## 📦 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| grammy | ^1.35.0 | Telegram bot framework |
| better-sqlite3 | ^11.7.0 | Local database |
| canvas | ^3.1.0 | Image/PNL card generation |
| dotenv | ^16.4.7 | Environment config |
| TypeScript | ^5.7.0 | Type safety |

## 🚀 Deployment

### Local Development
```bash
npm install
cp .env.example .env
# Edit .env with TELEGRAM_BOT_TOKEN
npm run dev
```

### Production
```bash
npm install
npm run build
npm start
```

### Process Manager (PM2)
```bash
pm2 start dist/index.js --name outsiders-bot
pm2 save
pm2 startup
```

## 🔌 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ Yes | — | Bot token from @BotFather |
| `CALL_CHANNEL_ID` | ❌ No | — | Channel ID for call forwarding |
| `DEXSCREENER_API` | ❌ No | `https://api.dexscreener.com` | API base URL |
| `ATH_POLL_INTERVAL` | ❌ No | `60` | Seconds between ATH polls |
| `LOG_LEVEL` | ❌ No | `info` | debug / info / warn / error |
| `DB_PATH` | ❌ No | `./outsiders.db` | SQLite database path |

## 💾 Database Schema

The bot uses SQLite with the following tables:

- `users` — User ID, username, first name, created_at
- `groups` — Group ID, group name, call_mode, display_mode, hardcore status
- `calls` — Call data (token, CA, entry_mcap, ath_mcap, points, timeframe)
- `user_blocks` — Block status per group
- `leaderboard_cache` — Cached leaderboard entries for performance

## 📞 Support & Contact

| Channel | Purpose |
|---------|---------|
| Group Admins | Direct access to `/settings`, `/block`, `/wipeleaderboard` |
| @OutsidersBotSupport | Privacy requests, data deletion, general support |
| Bot Creator | Bug reports, feature requests, deployment help |
| Telegram | Block the bot anytime using Telegram's built-in controls |

## 🔒 Security Best Practices

1. Store `.env` file securely (not in version control)
2. Rotate `TELEGRAM_BOT_TOKEN` if compromised
3. Use `DB_PATH` on encrypted storage
4. Run bot over HTTPS (if using webhook)
5. Restrict admin commands to trusted users only
6. Monitor logs for suspicious activity

## 📖 For Developers

- **Architecture:** See `README.md` for tech stack details
- **Code:** See `src/` for bot implementation
- **Tests:** Add unit tests in `src/__tests__/`
- **Docs:** Update `README.md` with new features

## ✨ What's Next?

1. ✅ Create bot in @BotFather
2. ✅ Set all metadata (name, description, picture, commands)
3. ✅ Add bot to test group
4. ✅ Run `/settings` to configure group behavior
5. ✅ Test all commands (`/help`, `/leaderboard`, `/alpha`, etc.)
6. ✅ Deploy to production
7. ✅ Monitor logs and performance
8. ✅ Iterate on features based on group feedback

---

**Bot Ready!** Use `BOTFATHER_SETUP.md` to configure in @BotFather, then deploy with Docker or PM2.
