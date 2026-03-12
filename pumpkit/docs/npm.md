# npm Packages

> **Coming Soon** — PumpKit packages will be published to npm for easy installation.

## Planned Packages

| Package | npm Name | Description |
|---------|----------|-------------|
| Core | `@pumpkit/core` | Shared framework — logger, health server, config, shutdown, types |
| Monitor | `@pumpkit/monitor` | All-in-one PumpFun monitoring bot (claims, launches, graduations, whale trades) |
| Channel | `@pumpkit/channel` | Read-only Telegram channel feed (broadcasts token events) |
| Claim | `@pumpkit/claim` | Fee claim tracker by token CA or X handle |
| Tracker | `@pumpkit/tracker` | Group call-tracking bot with leaderboards and PNL cards |

## Install (Coming Soon)

Once published, you'll be able to install packages directly:

```bash
# Install the core framework
npm install @pumpkit/core

# Install a specific bot
npm install @pumpkit/monitor

# Install everything
npm install @pumpkit/core @pumpkit/monitor @pumpkit/tracker @pumpkit/channel @pumpkit/claim
```

## Current Usage (Monorepo)

For now, clone the repo and use workspace references:

```bash
git clone https://github.com/nirholas/pumpkit.git
cd pumpkit
npm install

# Run a bot
npm run dev --workspace=@pumpkit/monitor

# Build all packages
npm run build
```

## Workspace References

Within the monorepo, packages reference each other via workspace protocol:

```json
{
  "dependencies": {
    "@pumpkit/core": "workspace:*"
  }
}
```

## Publishing Checklist

Before publishing to npm, we'll ensure:

- [ ] All packages compile cleanly with `tsc`
- [ ] Barrel exports (`index.ts`) expose stable public API
- [ ] `package.json` has correct `exports`, `main`, `types` fields
- [ ] `.npmignore` or `files` field limits published content
- [ ] `README.md` per package with install + usage instructions
- [ ] `CHANGELOG.md` per package
- [ ] CI pipeline runs tests before publish
- [ ] Scoped under `@pumpkit` npm organization

## Version Strategy

We'll follow [Semantic Versioning](https://semver.org/):

- **0.x.x** — Initial development (breaking changes allowed)
- **1.0.0** — First stable release
- All packages will be versioned independently

## Stay Updated

Watch the [GitHub repo](https://github.com/nirholas/pumpkit) for release announcements.
