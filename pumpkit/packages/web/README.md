# @pumpkit/web

> **Coming Soon** — Frontend dashboard and documentation site for PumpKit.

## Planned Features

### Documentation Site
- Landing page with project overview
- Package API docs (auto-generated from TypeScript)
- Tutorial browser with code examples
- Interactive architecture diagrams

### Bot Dashboard
- Real-time event feed (connects to monitor bot API)
- Watch management UI (add/remove wallets)
- Claim history with filtering and search
- Bot status and health monitoring
- SSE stream visualization

### Analytics
- Token launch timeline
- Fee claim charts
- Whale trade activity
- Graduation tracker

## Tech Stack (Planned)

| Tool | Purpose |
|------|---------|
| **Vite** | Build tool and dev server |
| **React** or **Solid** | UI framework (TBD) |
| **Tailwind CSS** | Styling |
| **Vercel** | Deployment |

## For the Agent Building This

Key resources to reference:

1. **Monitor API endpoints** — See [packages/monitor/src/api/](../monitor/src/api/) for the REST API + SSE the dashboard should connect to
2. **Example dashboards** — See [examples/](../../examples/) for standalone HTML dashboard patterns from the original project
3. **Bot data types** — See [packages/monitor/src/api/types.ts](../monitor/src/api/types.ts) for API response shapes
4. **Event types** — See [docs/events-reference.md](../../docs/events-reference.md) for all event types the UI should display
5. **Design reference** — The existing live dashboards use dark theme, neon accents, card layouts
6. **SSE streaming** — [packages/monitor/src/api/claimBuffer.ts](../monitor/src/api/claimBuffer.ts) implements the SSE endpoint

### API Endpoints to Consume

```
GET  /api/v1/health           → Bot status, uptime, connected wallets
GET  /api/v1/watches          → List watched wallets
POST /api/v1/watches          → Add a watch (body: { address: string })
DELETE /api/v1/watches/:addr  → Remove a watch
GET  /api/v1/claims           → Recent claim events (paginated)
GET  /api/v1/claims/stream    → SSE stream of real-time claims
POST /api/v1/webhooks         → Register webhook URL
DELETE /api/v1/webhooks/:id   → Remove webhook
```

### Design Direction

- Dark theme (crypto standard)
- Real-time updates (SSE/WebSocket)
- Mobile-responsive
- Minimal, data-dense dashboard style
- Card-based event feed (similar to Telegram message cards)

## Development

```bash
# From monorepo root
npm run dev --workspace=@pumpkit/web
```

## License

MIT
