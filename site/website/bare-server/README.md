# PumpOS Bare Server

A Bare Server implementation for PumpOS web proxy functionality. This server acts as the backend that fetches web pages and strips restrictive headers, enabling the Ultraviolet client to display any website.

## What is a Bare Server?

A Bare Server is a web server that:

- Fetches web content on behalf of clients
- Strips `X-Frame-Options` and `Content-Security-Policy` headers
- Handles cookies and sessions
- Supports WebSocket connections
- Enables access to sites that block iframes

## Deployment Options

### Option 1: Vercel (Recommended - Free)

1. **Install Vercel CLI** (if not installed):

   ```bash
   npm i -g vercel
   ```

2. **Deploy**:

   ```bash
   cd bare-server
   vercel
   ```

3. **Follow prompts** and get your URL like: `https://pumpos-bare.vercel.app`

### Option 2: Railway (Free tier available)

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub"
3. Select this repository and set root directory to `bare-server`
4. Railway will auto-detect and deploy

### Option 3: Render (Free tier available)

1. Go to [render.com](https://render.com)
2. New → Web Service
3. Connect your GitHub repo
4. Set:
   - Root Directory: `bare-server`
   - Build Command: `npm install`
   - Start Command: `npm start`

### Option 4: Local Development

```bash
cd bare-server
npm install
npm start
```

Server runs at `http://localhost:8080`

## Endpoints

| Endpoint      | Description                   |
| ------------- | ----------------------------- |
| `GET /`       | Server info and status        |
| `GET /status` | Health check                  |
| `/bare/*`     | Bare Server protocol endpoint |

## Testing

After deployment, test your server:

```bash
# Check if server is running
curl https://your-bare-server.vercel.app/

# Expected response:
# {"status":"ok","name":"PumpOS Bare Server","version":"1.0.0","bare":"/bare/"}
```

## Configuration

The server runs on port `8080` by default, or uses the `PORT` environment variable if set (required for most hosting platforms).

## Security Notes

- This server is designed to work with PumpOS
- Consider adding rate limiting for production use
- You may want to restrict CORS origins to your PumpOS domain

## Integration with PumpOS

Once deployed, update your PumpOS configuration to use this bare server URL. The Ultraviolet client will connect to `/bare/` endpoint.

Example:

```javascript
// In browser.html or UV config
const BARE_SERVER = "https://your-bare-server.vercel.app/bare/";
```
