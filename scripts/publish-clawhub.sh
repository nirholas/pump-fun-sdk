#!/usr/bin/env bash
# Publish all Pump SDK skill packs to ClawHub.
# Usage: bash scripts/publish-clawhub.sh [--dry-run]
#
# Prerequisites:
#   1. clawhub CLI installed: npm i -g clawhub
#   2. Logged in: clawhub login --token clh_...
#
set -euo pipefail

DRY_RUN=""
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN="echo [DRY-RUN]"
fi

SKILLS_DIR="$(cd "$(dirname "$0")/.." && pwd)/skills"
VERSION="1.0.0"
CHANGELOG="Initial release — Pump SDK agent skills for ClawHub"
TAGS="latest"

declare -A SKILL_NAMES=(
  [pump-sdk-core]="Pump SDK Core"
  [pump-bonding-curve]="Pump Bonding Curve"
  [pump-token-lifecycle]="Pump Token Lifecycle"
  [pump-fee-system]="Pump Fee System"
  [pump-fee-sharing]="Pump Fee Sharing"
  [pump-token-incentives]="Pump Token Incentives"
  [pump-solana-wallet]="Pump Solana Wallet"
  [pump-solana-architecture]="Pump Solana Architecture"
  [pump-solana-dev]="Pump Solana Development"
  [pump-rust-vanity]="Pump Rust Vanity Generator"
  [pump-ts-vanity]="Pump TypeScript Vanity Generator"
  [pump-mcp-server]="Pump MCP Server"
  [pump-shell-scripts]="Pump Shell Scripts"
  [pump-security]="Pump Security Practices"
  [pump-ai-agents]="Pump AI Agent Integration"
  [pump-admin-ops]="Pump Admin Operations"
  [pump-testing]="Pump Testing & Quality"
  [pump-build-release]="Pump Build & Release"
  [pump-website]="Pump Website"
  [pump-claims-readonly]="Pump Claims Read-Only"
)

echo "=== ClawHub Publish ==="
echo "Skills directory: $SKILLS_DIR"
echo "Version: $VERSION"
echo ""

SUCCESS=0
FAILED=0

for slug in "${!SKILL_NAMES[@]}"; do
  name="${SKILL_NAMES[$slug]}"
  folder="$SKILLS_DIR/$slug"

  if [[ ! -f "$folder/SKILL.md" ]]; then
    echo "SKIP: $slug (no SKILL.md found)"
    continue
  fi

  echo "Publishing: $slug ($name) ..."
  if $DRY_RUN clawhub publish "$folder" \
    --slug "$slug" \
    --name "$name" \
    --version "$VERSION" \
    --tags "$TAGS" \
    --changelog "$CHANGELOG" \
    --no-input 2>&1; then
    echo "  ✓ $slug published"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "  ✗ $slug FAILED"
    FAILED=$((FAILED + 1))
  fi
  echo ""
done

echo "=== Done ==="
echo "Published: $SUCCESS"
echo "Failed: $FAILED"
