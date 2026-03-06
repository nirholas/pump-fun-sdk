# Outsiders Bot — Privacy Policy

**Last Updated:** March 6, 2026

## Overview

Outsiders Bot is a Telegram call-tracking and leaderboard management bot. This privacy policy explains what data we collect, how we use it, and your rights regarding your information.

## Data Collection

### Information We Collect Automatically

When you interact with Outsiders Bot, we collect:

- **User Information:** Telegram user ID, username, first name, and last name
- **Group Information:** Group chat ID, group name, and group type (public/private)
- **Call Data:** Token contract addresses, chart URLs, call timestamps, call type (alpha/gamble)
- **Price Data:** Entry market cap, all-time high (ATH) market cap, token price data
- **Performance Data:** Points earned, win rate calculations, multiplier data, trading outcomes
- **Leaderboard Data:** Ranking positions, performance metrics, historical statistics

### Data Storage

- All data is stored in a **local SQLite database** (`outsiders.db`)
- Database location: `./outsiders.db` (configurable via `DB_PATH` environment variable)
- No data is uploaded to cloud services or third-party servers
- Data persists indefinitely unless explicitly deleted via admin commands

### Data We Do NOT Collect

- Private messages (DMs are processed but not logged)
- Wallet addresses or private keys
- Personal identifying information beyond Telegram profile
- Credit card or payment information
- Browsing history or IP logs

## How We Use Your Data

### Call Tracking
- Register and track your token calls across supported chains (Solana, Ethereum, Base, BSC)
- Calculate performance metrics (multiplier, points, win rate)
- Generate all-time high (ATH) metrics to measure call performance

### Leaderboards & Rankings
- Aggregate performance data to build leaderboards
- Calculate rankings by timeframe (24h, 7d, 30d, all-time)
- Display top performers and performance tiers (Amateur → Oracle)

### Analytics & PNL Cards
- Generate shareable performance cards (PNL cards)
- Calculate and display entry price, ATH, and gain percentages
- Provide win rate and performance statistics

### Group Administration
- Enforce group settings (call mode, display mode, hardcore mode)
- Track block/unblock status for users
- Reset leaderboards when requested via `/wipeleaderboard`

## Data Sharing

**We do not share your data with third parties.** Specifically:

- No data is sold to marketing companies
- No data is shared with analytics services
- No data is shared with other platforms or bots
- No data is shared with Telegram beyond what you post in group chats

### Public Display

Your call performance data may be displayed publicly in group leaderboards and statistics, including:
- Your Telegram username or user ID
- Total calls made, win rate, and points
- Call history and performance metrics

If you wish to keep this private, contact the group administrator.

## Data Security

- Database is stored locally on the bot server
- Access is controlled via Telegram chat permissions
- Admin commands (`/settings`, `/block`, `/wipeleaderboard`) are restricted to group administrators
- No encryption is applied to the database (encrypted storage recommended for production)

## Your Rights

### Data Deletion

You can request deletion of your data by:
1. **Individual Call Deletion:** Not supported; contact a group admin
2. **Full User Deletion:** Contact `@OutsidersBotSupport` or group administrators
3. **Group Leaderboard Reset:** Group admins can run `/wipeleaderboard` to clear all group data

### Data Access

To access your data:
1. Use `/rank` in a DM to see your cross-group statistics
2. Use `/calls @username` to see all your registered calls
3. Use `/winrate @username` to see your win rate and performance

### Data Portability

We do not currently provide automated data export. To request your data in a portable format, contact group administrators.

## Retention

- **Active Calls:** Retained indefinitely for leaderboard history
- **Deleted Users:** User data is retained if referenced in historical calls
- **Archived Groups:** Data persists if a group is deleted from Telegram

To completely remove your data, request via group admin or support.

## Children's Privacy

Outsiders Bot is not intended for users under 13. We do not knowingly collect data from children. If a child's data is collected, contact us immediately for deletion.

## Changes to This Policy

We may update this policy periodically. Changes take effect when posted. Continued use of the bot implies acceptance of updated terms.

## Contact & Support

For privacy concerns:
- **Group Admins:** Have direct access to `/settings`, `/block`, `/wipeleaderboard`
- **Bot Support:** Contact group administrators or the bot creator
- **Telegram:** You can block the bot anytime using Telegram's built-in controls

## Third-Party Services

Outsiders Bot integrates with:

- **DexScreener API** (`https://api.dexscreener.com`) — Fetches token price and market cap data
  - Privacy: DexScreener's privacy policy applies to their API calls
  - No personal data is sent to DexScreener (only contract addresses)

- **Telegram Bot API** — Processes messages through Telegram's infrastructure
  - Privacy: Telegram's privacy policy and terms apply
  - All group chats are end-to-end encrypted if configured in Telegram

## Legal Basis (GDPR/CCPA)

- **Data Collection:** Based on your voluntary use of the bot in Telegram groups
- **Legitimate Interest:** Improving leaderboard functionality and user experience
- **No Consent Required:** By using the bot, you agree to this policy

## Disclaimer

This bot is provided "as is" without warranty. We are not responsible for:
- Accuracy of token price data
- Market volatility or call performance
- Losses incurred based on calls tracked by this bot
- Telegram service interruptions

The bot is for entertainment and tracking purposes only. It is not financial advice.

---

**Questions?** Contact your group administrator or the bot creator for support.
