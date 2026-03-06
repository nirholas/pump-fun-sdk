# Outsiders Bot — BotFather Setup Guide

This guide provides all the commands you need to set up your bot in BotFather.

## Step 1: Create the Bot (if not already done)

In Telegram, message **@BotFather**:

```
/newbot
```

Follow the prompts to create a new bot. You'll receive a **BOT_TOKEN** (keep this secure).

## Step 2: Configure Bot Details

After creating your bot, send these commands to @BotFather:

### Set Display Name
```
/setname
```
Then select your bot and enter:
```
Outsiders Bot
```

### Set About Text
```
/setabouttext
```
Then select your bot and enter:
```
🎯 Track crypto calls, rank performance, and compete on leaderboards. Multi-chain analytics for serious traders.
```

### Set Description
```
/setdescription
```
Then select your bot and enter:
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

### Set Bot Picture
```
/setuserpic
```
Then select your bot and upload a profile picture (recommended: 200x200px PNG or JPG)

**Suggested images:**
- 🎯 Target/bullseye with crypto theme
- 📊 Chart with leaderboard medals
- 👥 Group silhouettes with trophy
- 🏆 Trophy with coins

### Set Commands List
```
/setcommands
```
Then select your bot and enter:
```
start - Start bot
help - Show help menu
leaderboard - Show calls or performance leaderboard
last - Show last N calls
calls - Show user's calls
winrate - Show user's win rate and stats
pnl - Generate PNL card for a token
alpha - Make an alpha call
gamble - Make a gamble call
rank - Your overall rank card (DM only)
hardcore - Show hardcore mode status
settings - Configure bot (admin only)
wipeleaderboard - Clear leaderboard (admin only)
block - Block user from calls (admin only)
unblock - Unblock user (admin only)
```

### Set Short Description (Optional)
```
/setshortdescription
```
Then select your bot and enter:
```
Call tracking with leaderboards & PNL analytics
```

### Set Default Administrator Rights (Optional)
```
/setdefaultadminrights
```
Then select your bot and configure permissions (recommended: allow manage group, pin messages, delete messages)

### Set Default Member Rights (Optional)
```
/setdefaultmemberrights
```
Then select your bot and configure permissions (recommended: allow post messages)

## Step 3: Environment Setup

In your `.env` file, add:

```env
TELEGRAM_BOT_TOKEN=<your_bot_token_from_botfather>
CALL_CHANNEL_ID=<optional_channel_id_for_forwarding>
DEXSCREENER_API=https://api.dexscreener.com
ATH_POLL_INTERVAL=60
LOG_LEVEL=info
DB_PATH=./outsiders.db
```

Replace `<your_bot_token_from_botfather>` with the token from @BotFather.

## Step 4: Add Bot to Groups

1. In Telegram, create a group and add your bot
2. Run `/settings` to configure group behavior
3. Set call mode (auto or manual), display mode, and hardcore settings

## Step 5: Deploy Bot

```bash
cd outsiders-bot
npm install
npm run build
npm start
```

For production, use a process manager like **PM2**:

```bash
pm2 start dist/index.js --name outsiders-bot
pm2 save
pm2 startup
```

## Optional: Webhook Setup

For faster message processing, you can set up a webhook instead of polling:

```
/setwebhook
```

Then send:
```
<your_webhook_url>
```

Contact @BotFather for webhook configuration help.

## Verification

Once deployed, test your bot:

1. `/start` — Should show welcome message
2. `/help` — Should list all commands
3. Paste a token CA in a group — Bot should register the call
4. `/leaderboard` — Should show empty leaderboard initially
5. `/settings` — Should allow admin configuration

## Privacy Policy URL (Optional)

If you host a privacy policy online, you can set it in BotFather:

```
/setbotcommandsscope
```

Then add your privacy policy URL in your bot settings by updating the `about` text with a link reference.

For now, users can reference the included `PRIVACY_POLICY.md` in the bot repo.

## Troubleshooting

- **Bot not responding?** Check `TELEGRAM_BOT_TOKEN` is correct
- **Commands not showing?** Run `/setcommands` again in BotFather
- **Database errors?** Ensure `DB_PATH` directory is writable
- **DexScreener timeouts?** Check `DEXSCREENER_API` URL and internet connection

---

**Ready to go!** Your bot is now fully configured and ready for group deployment.
