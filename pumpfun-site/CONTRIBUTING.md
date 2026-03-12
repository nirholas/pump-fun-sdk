# Contributing to Solana Launchpad UI

Thank you for your interest in contributing! This project is a static UI template — no build tools, no frameworks, pure HTML/CSS/JS.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/YOUR_USERNAME/solana-launchpad-ui.git`
3. **Open** `index.html` in your browser — that's it!

## Development

No build step required. Edit files, refresh browser.

```bash
# Optional: local dev server with auto-reload
npx serve .
```

## Guidelines

### Code Style

- **HTML** — Semantic elements, accessible (ARIA labels, alt text)
- **CSS** — Use existing CSS custom properties (`:root` variables), mobile-first
- **JS** — Vanilla ES6+, no external libraries, no build tools

### What We're Looking For

- 🎨 UI improvements and polish
- 📱 Mobile responsiveness fixes
- ♿ Accessibility improvements
- 🌍 i18n / localization
- 📊 New chart visualizations
- 🔌 Wallet adapter integration examples
- 📝 Documentation improvements
- 🐛 Bug fixes

### What We're NOT Looking For

- Framework rewrites (React, Vue, etc.) — this is intentionally vanilla
- npm dependencies — zero-dependency is a feature
- Build tooling (webpack, vite, etc.)
- Backend/server code

## Pull Request Process

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Test in multiple browsers (Chrome, Firefox, Safari)
4. Test on mobile viewport sizes
5. Commit with a clear message: `git commit -m 'Add token search autocomplete'`
6. Push: `git push origin feature/my-feature`
7. Open a Pull Request with:
   - What changed and why
   - Screenshots (for UI changes)
   - Browser/device testing notes

## Commit Messages

Use clear, descriptive commit messages:

```
Add bonding curve animation to token cards
Fix mobile nav overlay z-index issue
Update color scheme variables for better contrast
```

## Reporting Bugs

Use the [Bug Report template](https://github.com/nirholas/solana-launchpad-ui/issues/new?template=bug_report.md) with:

- Browser and version
- Device/viewport size
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

## Code of Conduct

Be respectful. This is an open, welcoming community. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
