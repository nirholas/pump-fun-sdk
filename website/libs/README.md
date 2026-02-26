# LairOS Shared Components

Shared vanilla JS UI/data primitives for LairOS apps.

## Files

- `lair-components.js` — global APIs (`LairFetch`, `LairUI`, `LairTheme`, `LairWS`, `LairPoll`)
- `lair-components.css` — shared styling tokens/classes
- `lair-bus.js` — inter-app communication (`LairBus`)

## Include in App HTML

```html
<link rel="stylesheet" href="../../libs/lair-components.css" />
<script src="../../libs/lair-components.js"></script>
<script src="../../libs/lair-bus.js"></script>
```

For files under `packages/os/appdata`, use `../libs/...` instead.

## APIs

### Data Fetcher

```js
await LairFetch.get(url, {
  cache: true,
  ttl: 30000,
  retries: 2,
  fallback: true,
});

await LairFetch.getJSON(url, {
  cache: true,
  ttl: 60000,
  retries: 2,
  fallback: true,
  container: document.getElementById("target"),
});
```

- Retries with exponential backoff
- In-memory TTL cache
- Optional loading/error rendering via `container`
- Optional CORS proxy fallback (`fallback: true`)

### UI Components

```js
LairUI.spinner(container);
LairUI.error(container, "Failed", retryFn);
LairUI.empty(container, "No data");
LairUI.table(container, { columns, data, sortable: true });
LairUI.price(value, change, { decimals: 2, symbol: "$" });
LairUI.tokenBadge(symbol, iconUrl, chain);
LairUI.sparkline(container, points, {
  width: 120,
  height: 32,
  color: "#6179ff",
});
```

### Theme

```js
LairTheme.isDark();
LairTheme.getColor("primary");
LairTheme.apply(document.body);
```

### Real-Time

```js
LairWS.subscribe("whales", (payload) => {
  console.log(payload);
});
LairWS.unsubscribe("whales");

LairPoll.start(fetchFn, 30000, (data, error) => {
  if (error) return;
  console.log(data);
});
LairPoll.stop();
```

### Inter-App Bus

```js
LairBus.register('portfolio');

LairBus.on('token:select', (payload) => {
  console.log(payload.symbol, payload.address, payload.chainId);
});

LairBus.send('cryptocharts', 'token:chart', {
  symbol: 'BTC',
  address: null,
  chainId: null,
});

LairBus.broadcast('theme:change', { mode: 'dark' });

const response = await LairBus.request('cryptocharts', 'token:chart', {
  symbol: 'ETH',
  address: null,
  chainId: null,
}, 2000);
```

- Uses parent-routed `postMessage` to communicate between app iframes
- Apps must call `LairBus.register(appId)` to receive messages
- Supports targeted send, broadcast, and request/response with timeout

## Migrated Proof-of-Concept Apps

- `packages/os/appdata/dashboard.html`
- `packages/os/Lair-Store/apps/portfolio-aggregator.html`
- `packages/os/Lair-Store/apps/gastracker.html`
- `packages/os/Lair-Store/apps/whalealerts.html`
- `packages/os/Lair-Store/apps/trending.html`
