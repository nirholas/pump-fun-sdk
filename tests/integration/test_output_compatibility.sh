#!/bin/bash
# ==============================================================================
# Cross-Implementation Output Compatibility Test
# ==============================================================================
# Verifies that all implementations (CLI, Rust, TypeScript) produce
# compatible keypair output that can be used interchangeably.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

# Test configuration
TEST_PREFIX="ab"
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

log_pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; }
log_fail() { echo -e "${RED}✗ FAIL${NC}: $1"; exit 1; }
log_info() { echo -e "${YELLOW}→${NC} $1"; }

echo "=============================================="
echo "Cross-Implementation Output Compatibility Test"
echo "=============================================="
echo ""

# Check for solana-keygen
if ! command -v solana-keygen &>/dev/null; then
    log_fail "solana-keygen not found in PATH"
fi

# ==============================================================================
# Generate keypairs with each implementation
# ==============================================================================

echo "--- Generating Keypairs ---"
echo ""

# CLI (using solana-keygen directly for baseline)
log_info "Generating with solana-keygen (CLI baseline)..."
CLI_KEY="$TEMP_DIR/cli-key.json"
if solana-keygen grind --starts-with "${TEST_PREFIX}:1" --no-bip39-passphrase 2>/dev/null; then
    # Find the generated file
    CLI_GENERATED=$(ls "${TEST_PREFIX}"*.json 2>/dev/null | head -1)
    if [[ -n "$CLI_GENERATED" ]]; then
        mv "$CLI_GENERATED" "$CLI_KEY"
        log_pass "CLI keypair generated"
    else
        log_fail "CLI keypair file not found"
    fi
else
    log_fail "CLI generation failed"
fi

# Rust implementation
log_info "Generating with Rust implementation..."
RUST_KEY="$TEMP_DIR/rust-key.json"
RUST_BIN="$PROJECT_ROOT/rust/target/release/solana-vanity"
if [[ -x "$RUST_BIN" ]]; then
    if "$RUST_BIN" --prefix "$TEST_PREFIX" --output "$RUST_KEY" --quiet 2>/dev/null; then
        log_pass "Rust keypair generated"
    else
        log_fail "Rust generation failed"
    fi
else
    log_info "Rust binary not found, skipping (run 'cargo build --release' first)"
    RUST_KEY=""
fi

# TypeScript implementation
log_info "Generating with TypeScript implementation..."
TS_KEY="$TEMP_DIR/ts-key.json"
TS_CLI="$PROJECT_ROOT/typescript/dist/index.js"
if [[ -f "$TS_CLI" ]]; then
    if node "$TS_CLI" --prefix "$TEST_PREFIX" --output "$TS_KEY" 2>/dev/null; then
        log_pass "TypeScript keypair generated"
    else
        log_fail "TypeScript generation failed"
    fi
else
    log_info "TypeScript dist not found, skipping (run 'npm run build' first)"
    TS_KEY=""
fi

echo ""
echo "--- Verifying Keypair Compatibility ---"
echo ""

# ==============================================================================
# Verify all keypairs can be loaded by solana-keygen
# ==============================================================================

verify_with_solana_keygen() {
    local keyfile="$1"
    local name="$2"
    
    if [[ -z "$keyfile" ]] || [[ ! -f "$keyfile" ]]; then
        log_info "Skipping $name (not generated)"
        return 0
    fi
    
    if solana-keygen pubkey "$keyfile" &>/dev/null; then
        log_pass "$name can be loaded by solana-keygen"
    else
        log_fail "$name cannot be loaded by solana-keygen"
    fi
}

verify_with_solana_keygen "$CLI_KEY" "CLI keypair"
verify_with_solana_keygen "$RUST_KEY" "Rust keypair"
verify_with_solana_keygen "$TS_KEY" "TypeScript keypair"

# ==============================================================================
# Verify JSON format (array of 64 numbers)
# ==============================================================================

echo ""
echo "--- Verifying JSON Format ---"
echo ""

verify_json_format() {
    local keyfile="$1"
    local name="$2"
    
    if [[ -z "$keyfile" ]] || [[ ! -f "$keyfile" ]]; then
        return 0
    fi
    
    # Check it's valid JSON
    if ! jq empty "$keyfile" 2>/dev/null; then
        log_fail "$name is not valid JSON"
    fi
    
    # Check it's an array of 64 numbers
    local length
    length=$(jq 'length' "$keyfile")
    if [[ "$length" != "64" ]]; then
        log_fail "$name has wrong length: $length (expected 64)"
    fi
    
    # Check all values are numbers 0-255
    local invalid
    invalid=$(jq '[.[] | select(type != "number" or . < 0 or . > 255)] | length' "$keyfile")
    if [[ "$invalid" != "0" ]]; then
        log_fail "$name has invalid byte values"
    fi
    
    log_pass "$name has correct JSON format (array of 64 bytes)"
}

verify_json_format "$CLI_KEY" "CLI keypair"
verify_json_format "$RUST_KEY" "Rust keypair"
verify_json_format "$TS_KEY" "TypeScript keypair"

# ==============================================================================
# Verify prefix matches
# ==============================================================================

echo ""
echo "--- Verifying Prefix Match ---"
echo ""

verify_prefix() {
    local keyfile="$1"
    local name="$2"
    local expected_prefix="$3"
    
    if [[ -z "$keyfile" ]] || [[ ! -f "$keyfile" ]]; then
        return 0
    fi
    
    local pubkey
    pubkey=$(solana-keygen pubkey "$keyfile" 2>/dev/null)
    
    # Case-insensitive prefix check
    local pubkey_lower="${pubkey,,}"
    local prefix_lower="${expected_prefix,,}"
    
    if [[ "$pubkey_lower" == "$prefix_lower"* ]]; then
        log_pass "$name has correct prefix: $pubkey"
    else
        log_fail "$name prefix mismatch: $pubkey (expected to start with $expected_prefix)"
    fi
}

verify_prefix "$CLI_KEY" "CLI keypair" "$TEST_PREFIX"
verify_prefix "$RUST_KEY" "Rust keypair" "$TEST_PREFIX"
verify_prefix "$TS_KEY" "TypeScript keypair" "$TEST_PREFIX"

# ==============================================================================
# Final summary
# ==============================================================================

echo ""
echo "=============================================="
echo -e "${GREEN}All compatibility tests passed!${NC}"
echo "=============================================="
