# PumpOS Shared Components

Shared vanilla JS UI/data primitives for PumpOS apps.

## Files

- `pump-components.js` — global APIs (`PumpFetch`, `PumpUI`, `PumpTheme`, `PumpWS`, `PumpPoll`)
- `pump-components.css` — shared styling tokens/classes
- `pump-bus.js` — inter-app communication (`PumpBus`)

## Include in App HTML

```html
<link rel="stylesheet" href="../../libs/pump-components.css" />
<script src="../../libs/pump-components.js"></script>
<script src="../../libs/pump-bus.js"></script>
```

For files under `packages/os/appdata`, use `../libs/...` instead.

## APIs

### Data Fetcher

```js
await PumpFetch.get(url, {
  cache: true,
  ttl: 30000,
  retries: 2,
  fallback: true,
});

await PumpFetch.getJSON(url, {
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
PumpUI.spinner(container);
PumpUI.error(container, "Failed", retryFn);
PumpUI.empty(container, "No data");
PumpUI.table(container, { columns, data, sortable: true });
PumpUI.price(value, change, { decimals: 2, symbol: "$" });
PumpUI.tokenBadge(symbol, iconUrl, chain);
PumpUI.sparkline(container, points, {
  width: 120,
  height: 32,
  color: "#6179ff",
});
```

### Theme

```js
PumpTheme.isDark();
PumpTheme.getColor("primary");
PumpTheme.apply(document.body);
```

### Real-Time

```js
PumpWS.subscribe("whales", (payload) => {
  console.log(payload);
});
PumpWS.unsubscribe("whales");

PumpPoll.start(fetchFn, 30000, (data, error) => {
  if (error) return;
  console.log(data);
});
PumpPoll.stop();
```

### Inter-App Bus

```js
PumpBus.register('portfolio');

PumpBus.on('token:select', (payload) => {
  console.log(payload.symbol, payload.address, payload.chainId);
});

PumpBus.send('cryptocharts', 'token:chart', {
  symbol: 'BTC',
  address: null,
  chainId: null,
});

PumpBus.broadcast('theme:change', { mode: 'dark' });

const response = await PumpBus.request('cryptocharts', 'token:chart', {
  symbol: 'ETH',
  address: null,
  chainId: null,
}, 2000);
```

- Uses parent-routed `postMessage` to communicate between app iframes
- Apps must call `PumpBus.register(appId)` to receive messages
- Supports targeted send, broadcast, and request/response with timeout

## Migrated Proof-of-Concept Apps

- `packages/os/appdata/dashboard.html`
- `packages/os/Pump-Store/apps/portfolio-aggregator.html`
- `packages/os/Pump-Store/apps/gastracker.html`
- `packages/os/Pump-Store/apps/whalealerts.html`
- `packages/os/Pump-Store/apps/trending.html`
