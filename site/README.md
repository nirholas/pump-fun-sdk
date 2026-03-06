# Pump Fun SDK 

> A web-based operating system built entirely with HTML, CSS, and JavaScript, running in your browser.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](license.md)

## Features

- 🖥️ **Full Desktop Experience** - Windows, taskbar, start menu, and notifications
- 📁 **Virtual File System** - Encrypted storage with IndexedDB
- 🔐 **Multi-User Support** - Separate encrypted profiles per user
- 🛒 **App Store** - Install and manage third-party apps
- 🎨 **Themes** - Customizable appearance with CSS variables
- 📴 **Offline Support** - Service Worker caching for offline use
- 🔌 **NTX API** - Apps can interact with the OS via postMessage

## Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/nirholas/pump-sdk.git
   cd pump-sdk
   ```

2. Serve with any static file server:
   ```bash
   npx serve
   # or use VS Code Live Server
   ```

3. Open in a modern browser and follow the setup wizard

### Default Credentials
- **Username:** `Admin`
- **Password:** `pump`

## Documentation

| Document | Description |
|----------|-------------|
| [📖 Full Documentation](docs/README.md) | Complete documentation index |
| [🏗️ Architecture](docs/ARCHITECTURE.md) | Technical deep-dive into system internals |
| [🛠️ Creating Apps](docs/CREATING-APPS.md) | Guide to building apps for the Pump Store |

## Creating Apps

Want to build an app for Pump Fun SDK? Check out the [Creating Apps Guide](docs/CREATING-APPS.md).

**Quick overview:**

1. Create an HTML file in `/Pump-Sdk/apps/`
2. Add your app entry to `/Pump-Sdk/db/v2.json`:

```json
{
  "name": "My App",
  "src": "/Pump-Sdk/apps/myapp.html",
  "by": "developer",
  "qt": "Short tagline",
  "desc": "App description",
  "cat": "tools",
  "symbol": "terminal",
  "th": "#5FFCA6"
}
```

## Project Structure

```
pump-sdk/
├── index.html          # Main entry point
├── script.js           # Main application logic
├── system32.js         # Core system functions
├── scripts/            # Core modules (kernel, windman, etc.)
├── appdata/            # Built-in app HTML files
├── Pump-Sdk/       # App store
│   ├── apps/           # Store app HTML files
│   └── db/v2.json      # App registry database
├── assets/             # Images and icons
└── docs/               # Documentation
```

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Security

See [SECURITY.md](SECURITY.md) for security policies and reporting vulnerabilities.

## License

This project is licensed under the MIT License - see [license.md](license.md) for details.

