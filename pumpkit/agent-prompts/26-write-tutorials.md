# Agent Task 26: Write Tutorials for PumpKit

## Context

We're building **PumpKit** (`/workspaces/pump-fun-sdk/pumpkit/`). Read `pumpkit/README.md` for the project overview and `pumpkit/docs/getting-started.md` for the existing quickstart.

Also reference the existing pump-fun-sdk tutorials for style:
- `/workspaces/pump-fun-sdk/tutorials/` — 43 tutorials, look at a few for format

## Task

Create 6 tutorials under `/workspaces/pump-fun-sdk/pumpkit/tutorials/`:

### 1. `01-your-first-bot.md`
**Build Your First PumpFun Bot (10 minutes)**
- Create project from scratch
- Install @pumpkit/core
- Write a minimal claim alert bot (< 40 lines)
- Run locally with tsx
- Test with /start and /watch commands

### 2. `02-channel-broadcast.md`
**Set Up a PumpFun Channel Feed**
- Create a Telegram channel
- Configure the monitor bot in broadcast mode
- Enable/disable specific feeds
- Customize whale threshold
- Deploy to Railway

### 3. `03-custom-monitors.md`
**Build Custom Event Monitors**
- Extend BaseMonitor to create your own
- Subscribe to specific program logs
- Decode custom events
- Wire to Telegram notifications
- Example: monitor a specific token's trades

### 4. `04-group-tracker.md`
**Set Up Call Tracking in Your Group**
- Create a tracker bot
- Add to a Telegram group
- Configure settings (auto/button mode)
- Enable hardcore mode
- Customize leaderboard timeframes

### 5. `05-deploy-railway.md`
**Deploy to Railway in 5 Minutes**
- Install Railway CLI
- Initialize project
- Set environment variables
- Deploy with persistent volumes
- Monitor logs and health

### 6. `06-add-webhooks-api.md`
**Add REST API + Webhooks**
- Enable the API layer
- Set up authentication
- Register webhook URLs
- Stream events via SSE
- Build a simple dashboard that consumes the API

## Requirements

- Each tutorial should be practical, with complete code examples
- Step-by-step format with numbered instructions
- Include expected output for each step
- 300-500 lines per tutorial (not too long)
- Reference @pumpkit/core API throughout
- Include "What you'll build" section at the top
- Include "Next steps" section at the bottom

## Do NOT

- Don't write documentation (that's in docs/)
- Don't assume readers have read other tutorials — each should be self-contained
- Don't include theoretical explanations — keep it hands-on
