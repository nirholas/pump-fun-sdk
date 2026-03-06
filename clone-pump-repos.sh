#!/bin/bash
set -e

TARGET_DIR="/workspaces/pump-fun-sdk/pump-fun-repos"
mkdir -p "$TARGET_DIR"
cd "$TARGET_DIR"

REPOS=(
  "carbon"
  "pump-public-docs"
  "transfer-hook-authority"
  "pump-segments-sdk"
  "react-native-pager-view"
)

for repo in "${REPOS[@]}"; do
  if [ -d "$repo" ]; then
    echo "=== $repo already exists, skipping ==="
  else
    echo "=== Cloning $repo ==="
    git clone "https://github.com/pump-fun/$repo.git" "$repo"
    echo "=== $repo DONE ==="
  fi
done

echo ""
echo "ALL CLONES COMPLETE"
ls -la "$TARGET_DIR"
