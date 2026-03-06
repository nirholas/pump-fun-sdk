# Changelog

All notable changes to Pump Fun SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive documentation in `/docs` folder
- White-label guide for rebranding
- Component design documentation for refactoring

### Changed
- N/A

### Fixed
- N/A

---

## [1.0.0] - 2024-XX-XX

### Added
- Initial release of Pump Fun SDK
- Multi-user support with encrypted storage
- Window management system (drag, resize, snap)
- NTX API for app development
- Built-in apps:
  - Browser
  - Calculator
  - Camera
  - Files
  - Gallery
  - Music Player
  - Settings
  - Text Editor
  - Welcome
- Pump Store for third-party apps
- Rotur integration for networking
- Theme system with CSS variables
- PWA support with offline capability
- BIOS for backup/restore
- Context menu system

### Security
- AES-GCM encryption for user data
- PBKDF2 key derivation (100,000 iterations)
- Per-user isolated IndexedDB databases
- Sandboxed iframe app execution

---

## Version History Format

Each release should document:

### Added
- New features

### Changed
- Changes to existing functionality

### Deprecated
- Features to be removed in future versions

### Removed
- Features removed in this version

### Fixed
- Bug fixes

### Security
- Security patches and improvements
