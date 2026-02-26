# GMGN Proxy Worker

A Cloudflare Worker that proxies requests to GMGN.ai to bypass Cloudflare protection.

## Deployment

### Prerequisites
- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

### Steps

1. **Install Wrangler**
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**
   ```bash
   wrangler login
   ```

3. **Deploy the Worker**
   ```bash
   cd workers/gmgn-proxy
   wrangler deploy
   ```

4. **Get your Worker URL**
   After deployment, you'll get a URL like:
   ```
   https://gmgn-proxy.your-subdomain.workers.dev
   ```

5. **Configure in Dashboard**
   Update the Smart Money widget configuration in your app:
   ```javascript
   SmartMoneyWidget.init('smartMoneyWidget', {
       proxyUrl: 'https://gmgn-proxy.your-subdomain.workers.dev/proxy'
   });
   ```

## API Usage

### Proxy GMGN Endpoints

```
GET /proxy?endpoint=/rank/sol/swaps/7d&limit=50
```

**Available GMGN endpoints:**
- `/rank/sol/swaps/7d` - Top wallets by 7-day PnL
- `/rank/sol/swaps/30d` - Top wallets by 30-day PnL  
- `/tokens/top_traders/sol/{token_address}` - Top traders for a token
- `/wallet/sol/wallet_info/{wallet_address}` - Wallet details
- `/signals/sol/smart_buy` - Smart money buy signals
- `/signals/sol/smart_sell` - Smart money sell signals

### Health Check

```
GET /health
```

## Rate Limiting

- 30 requests per minute per IP
- Responses are cached for 30 seconds

## Cloudflare Bypass Notes

GMGN uses aggressive Cloudflare protection. The proxy works best when:

1. **Session cookies are set** (optional enhancement):
   ```toml
   # wrangler.toml
   [vars]
   GMGN_COOKIES = "cf_clearance=..."
   ```
   
   To get cookies:
   - Open GMGN in browser
   - Open DevTools → Application → Cookies
   - Copy the `cf_clearance` cookie value

2. **Using browser-like headers** (already configured in the worker)

3. **If blocked**: The worker will return a 503 error with `suggestion: 'Session cookies may need to be refreshed'`

## Alternative: Use Birdeye/Helius

If GMGN proxy is unreliable, the Smart Money service also supports:

- **Birdeye API**: `SmartMoneyService.config.birdeye.apiKey = 'your-key'`
- **Helius API**: `SmartMoneyService.config.helius.apiKey = 'your-key'`

These provide similar wallet tracking data with proper API access.
