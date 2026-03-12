# PumpKit Examples

Reference implementations from the original PumpFun SDK live dashboards.

## Dashboards

| File | Description |
|------|-------------|
| [index.html](index.html) | Main dashboard landing — navigation and layout skeleton |
| [dashboard.html](dashboard.html) | Real-time token launch feed with WebSocket connection |
| [trades.html](trades.html) | Live trade display with buy/sell indicators |

## Using These Examples

These are standalone HTML/JS files that connect to PumpFun's public APIs. Open them directly in a browser:

```bash
# From the examples directory
npx serve .
```

They demonstrate patterns useful for building the PumpKit web dashboard:
- WebSocket event handling
- Real-time card rendering
- Dark theme styling
- Responsive layouts
- Auto-reconnection logic

## For the Web Dashboard

The `@pumpkit/web` package ([packages/web/](../packages/web/)) is the official dashboard being built.
It will connect to the `@pumpkit/monitor` REST API instead of PumpFun directly.

See [packages/web/UI_SPEC.md](../packages/web/UI_SPEC.md) for the full design specification.
