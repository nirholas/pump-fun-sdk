# Project Governance

> How decisions are made in pump-fun-sdk.

---

## Overview

pump-fun-sdk uses a **Benevolent Dictator For Life (BDFL)** governance model with strong emphasis on community input. The project is led by [@nirholas](https://github.com/nirholas) with contributions welcome from everyone.

---

## Roles

### Maintainer (BDFL)

**[@nirholas](https://github.com/nirholas)** — Final decision-maker on:

- Project direction and roadmap
- Release management
- Security decisions
- Merge authority for all PRs
- Community moderation

### Contributors

Anyone who has submitted a merged PR. Contributors:

- Are credited in [ACKNOWLEDGMENTS.md](ACKNOWLEDGMENTS.md)
- May be invited to become collaborators based on sustained contribution
- Have a voice in discussions and RFCs
- Can review PRs (non-binding reviews)

### Collaborators

Trusted contributors with write access. Collaborators:

- Can merge PRs (with maintainer approval on breaking changes)
- Can triage issues and manage labels
- Can moderate discussions
- Are listed in [CODEOWNERS](.github/CODEOWNERS)

---

## Decision Making

### Minor Changes

Bug fixes, documentation updates, dependency bumps, and non-breaking improvements can be merged by any collaborator after one approving review.

### Significant Changes

New features, API changes, and architectural decisions require:

1. An issue or discussion describing the proposal
2. At least 72 hours for community feedback
3. Maintainer approval

### Breaking Changes

Any change that breaks the public API requires:

1. An RFC discussion with clear migration path
2. At least 1 week for community feedback
3. Deprecation notice in the previous release
4. Maintainer approval
5. Documentation in [MIGRATION.md](docs/MIGRATION.md)

---

## Conflict Resolution

1. Discuss in the relevant issue or PR
2. If unresolved, escalate to a GitHub Discussion
3. Maintainer makes final call, with reasoning documented

---

## Meetings

No regular meetings. All coordination happens asynchronously on GitHub via:

- Issues for bugs and features
- Discussions for RFCs and open-ended topics
- PRs for code review

---

## Evolution

This governance model may evolve as the project grows. Significant changes to governance require a community discussion and maintainer approval.

---

*Inspired by governance models from Node.js, Rust, and other successful open-source projects.*
