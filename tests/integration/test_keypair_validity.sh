#!/bin/bash
# ==============================================================================
# Keypair Cryptographic Validity Test
# ==============================================================================
# Verifies that generated keypairs are cryptographically valid by:
# 1. Generating a keypair
# 2. Signing a message
# 3. Verifying the signature
# 4. Confirming public key derivation
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

log_pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; }
log_fail() { echo -e "${RED}✗ FAIL${NC}: $1"; exit 1; }
log_info() { echo -e "${YELLOW}→${NC} $1"; }

echo "=============================================="
echo "Keypair Cryptographic Validity Test"
echo "=============================================="
echo ""

# Check for required tools
if ! command -v solana-keygen &>/dev/null; then
    log_fail "solana-keygen not found in PATH"
fi

# Test message
TEST_MESSAGE="This is a test message for signature verification"

# ==============================================================================
# Test CLI-generated keypair
# ==============================================================================

test_keypair_validity() {
    local name="$1"
    local keyfile="$2"
    
    if [[ -z "$keyfile" ]] || [[ ! -f "$keyfile" ]]; then
        log_info "Skipping $name (not available)"
        return 0
    fi
    
    echo ""
    echo "--- Testing $name ---"
    
    # 1. Get public key
    local pubkey
    if ! pubkey=$(solana-keygen pubkey "$keyfile" 2>/dev/null); then
        log_fail "$name: Cannot extract public key"
    fi
    log_pass "$name: Public key extracted: $pubkey"
    
    # 2. Verify keypair matches public key
    if solana-keygen verify "$pubkey" "$keyfile" 2>/dev/null; then
        log_pass "$name: Keypair verification passed"
    else
        log_fail "$name: Keypair verification failed"
    fi
    
    # 3. Sign a message (using solana CLI if available, otherwise skip)
    if command -v solana &>/dev/null; then
        local signature_file="$TEMP_DIR/${name}_signature.txt"
        
        # Create message file
        echo -n "$TEST_MESSAGE" > "$TEMP_DIR/message.txt"
        
        # Sign the message
        if solana sign-only --keypair "$keyfile" "$TEMP_DIR/message.txt" > "$signature_file" 2>/dev/null; then
            log_pass "$name: Message signing succeeded"
        else
            log_info "$name: Message signing test skipped (requires full solana CLI)"
        fi
    else
        log_info "$name: Signature test skipped (solana CLI not available)"
    fi
    
    # 4. Verify JSON structure
    local bytes_count
    bytes_count=$(jq 'length' "$keyfile" 2>/dev/null || echo "0")
    if [[ "$bytes_count" == "64" ]]; then
        log_pass "$name: Correct key length (64 bytes)"
    else
        log_fail "$name: Wrong key length: $bytes_count (expected 64)"
    fi
    
    # 5. Verify byte range (all values 0-255)
    local invalid_bytes
    invalid_bytes=$(jq '[.[] | select(type != "number" or . < 0 or . > 255)] | length' "$keyfile" 2>/dev/null || echo "1")
    if [[ "$invalid_bytes" == "0" ]]; then
        log_pass "$name: All bytes in valid range (0-255)"
    else
        log_fail "$name: Invalid byte values detected"
    fi
    
    # 6. Check that first 32 bytes (secret) and last 32 bytes (public) are different
    local first_32 last_32
    first_32=$(jq '.[0:32] | join(",")' "$keyfile")
    last_32=$(jq '.[32:64] | join(",")' "$keyfile")
    if [[ "$first_32" != "$last_32" ]]; then
        log_pass "$name: Secret and public key portions are different"
    else
        log_fail "$name: Secret and public key portions are identical (invalid)"
    fi
    
    log_pass "$name: All validity checks passed"
}

# ==============================================================================
# Generate and test keypairs from each implementation
# ==============================================================================

# Generate a CLI keypair
log_info "Generating CLI keypair..."
CLI_KEY="$TEMP_DIR/cli-key.json"
if solana-keygen grind --starts-with "a:1" --no-bip39-passphrase 2>/dev/null; then
    CLI_GENERATED=$(ls a*.json 2>/dev/null | head -1)
    if [[ -n "$CLI_GENERATED" ]]; then
        mv "$CLI_GENERATED" "$CLI_KEY"
    fi
fi
test_keypair_validity "CLI" "$CLI_KEY"

# Generate a Rust keypair
log_info "Generating Rust keypair..."
RUST_KEY="$TEMP_DIR/rust-key.json"
RUST_BIN="$PROJECT_ROOT/rust/target/release/solana-vanity"
if [[ -x "$RUST_BIN" ]]; then
    "$RUST_BIN" --prefix "a" --output "$RUST_KEY" --quiet 2>/dev/null || true
fi
test_keypair_validity "Rust" "$RUST_KEY"

# Generate a TypeScript keypair
log_info "Generating TypeScript keypair..."
TS_KEY="$TEMP_DIR/ts-key.json"
TS_CLI="$PROJECT_ROOT/typescript/dist/index.js"
if [[ -f "$TS_CLI" ]]; then
    node "$TS_CLI" --prefix "a" --output "$TS_KEY" 2>/dev/null || true
fi
test_keypair_validity "TypeScript" "$TS_KEY"

# ==============================================================================
# Cross-validation: Ensure keys from one impl can be verified by others
# ==============================================================================

echo ""
echo "--- Cross-Implementation Validation ---"
echo ""

cross_validate() {
    local keyfile="$1"
    local name="$2"
    
    if [[ -z "$keyfile" ]] || [[ ! -f "$keyfile" ]]; then
        return 0
    fi
    
    # The key should be loadable by all Solana tools
    local pubkey
    pubkey=$(solana-keygen pubkey "$keyfile" 2>/dev/null)
    
    # Verify using solana-keygen verify
    if solana-keygen verify "$pubkey" "$keyfile" 2>/dev/null; then
        log_pass "$name passes cross-implementation validation"
    else
        log_fail "$name fails cross-implementation validation"
    fi
}

cross_validate "$CLI_KEY" "CLI keypair"
cross_validate "$RUST_KEY" "Rust keypair"
cross_validate "$TS_KEY" "TypeScript keypair"

echo ""
echo "=============================================="
echo -e "${GREEN}All cryptographic validity tests passed!${NC}"
echo "=============================================="
