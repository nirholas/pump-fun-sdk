#!/bin/bash
# ==============================================================================
# File Permission Checker
# ==============================================================================
# Verifies that all keypair JSON files have correct permissions (600).
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

# Configuration
SEARCH_DIR="${1:-$PROJECT_ROOT}"
EXPECTED_PERMS="600"

echo "=============================================="
echo "File Permission Checker"
echo "=============================================="
echo ""
echo "Searching in: $SEARCH_DIR"
echo "Expected permissions: $EXPECTED_PERMS"
echo ""

INSECURE_COUNT=0
SECURE_COUNT=0
SKIPPED_COUNT=0

# Skip these files (config files, not keypairs)
SKIP_PATTERNS=(
    "package.json"
    "package-lock.json"
    "tsconfig.json"
    "jest.config.js"
    "Cargo.lock"
    ".json"  # Hidden files
    "node_modules"
    "target"
)

should_skip() {
    local file="$1"
    for pattern in "${SKIP_PATTERNS[@]}"; do
        if [[ "$file" == *"$pattern"* ]]; then
            return 0
        fi
    done
    return 1
}

is_likely_keypair() {
    local file="$1"
    
    # Check if file contains array of 64 numbers (keypair format)
    if [[ -f "$file" ]] && jq 'if type == "array" and length == 64 then true else false end' "$file" 2>/dev/null | grep -q "true"; then
        return 0
    fi
    return 1
}

echo "--- Scanning for keypair files ---"
echo ""

while IFS= read -r -d '' file; do
    # Skip known non-keypair files
    if should_skip "$file"; then
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
        continue
    fi
    
    # Check if it looks like a keypair file
    if ! is_likely_keypair "$file"; then
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
        continue
    fi
    
    # Get file permissions
    if [[ "$(uname)" == "Darwin" ]]; then
        perms=$(stat -f "%Lp" "$file" 2>/dev/null)
    else
        perms=$(stat -c "%a" "$file" 2>/dev/null)
    fi
    
    if [[ -z "$perms" ]]; then
        echo -e "${YELLOW}⚠${NC} Could not check: $file"
        continue
    fi
    
    if [[ "$perms" == "$EXPECTED_PERMS" ]]; then
        echo -e "${GREEN}✓${NC} $file (permissions: $perms)"
        SECURE_COUNT=$((SECURE_COUNT + 1))
    else
        echo -e "${RED}✗${NC} $file (permissions: $perms, expected: $EXPECTED_PERMS)"
        INSECURE_COUNT=$((INSECURE_COUNT + 1))
    fi
done < <(find "$SEARCH_DIR" -name "*.json" -type f -print0 2>/dev/null)

# ==============================================================================
# Summary
# ==============================================================================

echo ""
echo "=============================================="
echo "Summary"
echo "=============================================="
echo ""
echo "Secure files:   $SECURE_COUNT"
echo "Insecure files: $INSECURE_COUNT"
echo "Skipped:        $SKIPPED_COUNT (non-keypair files)"
echo ""

if [[ $INSECURE_COUNT -eq 0 ]]; then
    if [[ $SECURE_COUNT -eq 0 ]]; then
        echo -e "${YELLOW}No keypair files found${NC}"
        echo ""
        echo "This is normal if you haven't generated any keypairs yet."
    else
        echo -e "${GREEN}All keypair files have secure permissions!${NC}"
    fi
    exit 0
else
    echo -e "${RED}WARNING: $INSECURE_COUNT file(s) have insecure permissions!${NC}"
    echo ""
    echo "To fix, run:"
    echo "  chmod 600 <file>"
    echo ""
    echo "Or to fix all keypair files:"
    echo "  find $SEARCH_DIR -name '*.json' -exec chmod 600 {} \\;"
    exit 1
fi
