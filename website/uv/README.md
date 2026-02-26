# Ultraviolet Proxy for LairOS

This directory contains the Ultraviolet web proxy client that enables LairOS to browse any website, even those that block iframes.

## Files

| File            | Purpose                      |
| --------------- | ---------------------------- |
| `uv.bundle.js`  | Main UV library with codecs  |
| `uv.client.js`  | Client-side URL rewriting    |
| `uv.handler.js` | Request handler              |
| `uv.sw.js`      | Service worker (interceptor) |
| `uv.config.js`  | Configuration file           |
| `sw.js`         | Service worker wrapper       |

## How It Works

1. User enters a URL in the UV Browser
2. URL is encoded using XOR codec
3. Service Worker intercepts the request
4. Request is sent to OpenBare (https://openbare.xyz)
5. OpenBare fetches the page, strips blocking headers
6. Content is returned and displayed in iframe

## Configuration

Edit `uv.config.js` to change the OpenBare server URL:

```javascript
self.__uv$config = {
  bare: "https://openbare.xyz/bare/",
  // ... other options
};
```

Also update `sw.js` with the same bare server URL.

## OpenBare

LairOS uses [OpenBare](https://github.com/nirholas/openbare) as its proxy backend. The production server runs at:

- **Production**: `https://openbare.xyz/bare/`
- **Local dev**: `http://localhost:8080/bare/`

## Production Setup

1. OpenBare is already deployed at `https://openbare.xyz`
2. `uv.config.js` and `sw.js` are pre-configured
3. Test with sites like google.com, youtube.com

## Testing Locally

1. Clone OpenBare: `git clone https://github.com/nirholas/openbare`
2. Run the edge server locally (see OpenBare docs)
3. Update `uv.config.js` bare URL to `http://localhost:8080/bare/`
4. Serve LairOS: `npx serve` (from root)
5. Open LairOS and launch "UV Browser" from the store

## Troubleshooting

### "Proxy server offline"

- Check if https://openbare.xyz is reachable
- Check CORS settings if using a different bare server

### Service Worker not registering

- Ensure you're serving over HTTPS (or localhost)
- Check browser console for errors

### Page not loading

- Some sites have additional protections
- Check OpenBare logs for errors
