

---



---

## Agent 4: DeFi Features

```
You are working on Pump Fun SDK, a web-based operating system at /workspaces/pump-sdk.

## Your Task: DeFi-Specific Features

Complete these crypto/DeFi features:

### 1. Wallet Connect Widget
- Create /workspaces/pump-sdk/appdata/wallet.html
- Support WalletConnect v2 or mock connection for demo
- Show connected wallet address (truncated)
- Display ETH/token balances
- Network selector (Ethereum, Arbitrum, Base, Polygon)
- Disconnect button
- Add to desktop and store
- If real wallet connect is complex, create polished mock UI that simulates connection

### 2. Price Alerts Widget
- Create /workspaces/pump-sdk/appdata/alerts.html
- Set alerts: "BTC above $100k", "ETH below $3000"
- Use CoinGecko API for price checks
- Check prices every 60 seconds
- Trigger notification when alert conditions met
- List of active alerts with delete option
- Persist alerts in localStorage
- Add to store

### 3. Transaction History Viewer
- Create /workspaces/pump-sdk/appdata/txhistory.html
- Input: wallet address (or use connected wallet)
- Fetch from Etherscan API (free tier) or mock data
- Show: date, type (send/receive/swap), amount, hash
- Link to block explorer
- Filter by type, date range
- Clean table UI with pagination
- Add to store

### 4. Gas Estimator Tool
- Create /workspaces/pump-sdk/appdata/gasestimator.html
- Show current gas prices (low/medium/high) in Gwei
- Estimate cost for common operations:
  - ETH transfer (~21,000 gas)
  - ERC20 transfer (~65,000 gas)
  - Uniswap swap (~150,000 gas)
  - NFT mint (~100,000 gas)
- Show cost in USD (gas × gwei × ETH price)
- Auto-refresh every 30 seconds
- Historical gas chart (last 24h if API available)
- Add to store and dashboard widget option

## Key Files to Create
- /workspaces/pump-sdk/appdata/wallet.html
- /workspaces/pump-sdk/appdata/alerts.html
- /workspaces/pump-sdk/appdata/txhistory.html
- /workspaces/pump-sdk/appdata/gasestimator.html

## Files to Update
- /workspaces/pump-sdk/Pump-Sdk/db/v2.json (add all 4 apps)
- /workspaces/pump-sdk/script.js (add to defAppsList if needed)

## APIs
- CoinGecko: https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin&vs_currencies=usd
- CoinGecko gas: Check their API for gas data
- Etherscan (free): https://api.etherscan.io/api (rate limited)
- For demo, mock data is acceptable with realistic values

## Technical Notes
- Match existing app styling (dark theme, glass morphism)
- Use CSS variables: --bg, --text, --accent, --glass
- Each app should be self-contained HTML with inline CSS/JS
- Integrate with notification system from Agent 3 for alerts
- Test all API calls handle errors gracefully

## Git
Commit as "nirholas" <nirholas@users.noreply.github.com>
Push to main when complete.
```

---

## Summary

| Agent | Focus | New Files | Key Deliverables |
|-------|-------|-----------|------------------|
| 1 | Desktop Polish | - | Multi-select, drag icons, context menu, grid snap, arrange |
| 2 | Window Management | - | Snap to edges, minimize anim, show desktop, taskbar previews |
| 3 | System Features | sounds/ | Notifications, sounds, lock screen, screenshot, clipboard |
| 4 | DeFi Features | 4 apps | Wallet, alerts, tx history, gas estimator |

Each agent can work independently. Agent 4 depends slightly on Agent 3's notification system for price alerts.