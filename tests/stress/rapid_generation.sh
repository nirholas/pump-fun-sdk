#!/bin/bash
# ==============================================================================
# Rapid Generation Stress Test
# ==============================================================================
# Tests rapid sequential keypair generation to verify:
# - No file collisions
# - All files have correct permissions
# - All keypairs are valid
# - No data corruption
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

# Configuration
NUM_KEYPAIRS=${1:-20}  # Default 20 keypairs

echo "=============================================="
echo "Rapid Generation Stress Test"
echo "=============================================="
echo ""
echo "Generating $NUM_KEYPAIRS keypairs per implementation"
echo ""

log_pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; }
log_fail() { echo -e "${RED}✗ FAIL${NC}: $1"; }
log_info() { echo -e "${YELLOW}→${NC} $1"; }

# ==============================================================================
# Verification Functions
# ==============================================================================

verify_keypair() {
    local file="$1"
    local name="$2"
    local errors=0
    
    # 1. File exists
    if [[ ! -f "$file" ]]; then
        log_fail "$name: File does not exist"
        return 1
    fi
    
    # 2. Correct permissions
    local perms
    perms=$(stat -c "%a" "$file" 2>/dev/null || stat -f "%Lp" "$file" 2>/dev/null)
    if [[ "$perms" != "600" ]]; then
        log_fail "$name: Wrong permissions ($perms, expected 600)"
        errors=$((errors + 1))
    fi
    
    # 3. Valid JSON
    if ! jq empty "$file" 2>/dev/null; then
        log_fail "$name: Invalid JSON"
        return 1
    fi
    
    # 4. Correct length (64 bytes)
    local length
    length=$(jq 'length' "$file")
    if [[ "$length" != "64" ]]; then
        log_fail "$name: Wrong length ($length, expected 64)"
        errors=$((errors + 1))
    fi
    
    # 5. Valid byte range
    local invalid
    invalid=$(jq '[.[] | select(type != "number" or . < 0 or . > 255)] | length' "$file")
    if [[ "$invalid" != "0" ]]; then
        log_fail "$name: Invalid byte values"
        errors=$((errors + 1))
    fi
    
    # 6. Can be verified by solana-keygen
    if command -v solana-keygen &>/dev/null; then
        local pubkey
        if ! pubkey=$(solana-keygen pubkey "$file" 2>/dev/null); then
            log_fail "$name: Cannot extract public key"
            errors=$((errors + 1))
        else
            # Verify keypair
            if ! solana-keygen verify "$pubkey" "$file" 2>/dev/null; then
                log_fail "$name: Keypair verification failed"
                errors=$((errors + 1))
            fi
        fi
    fi
    
    return $errors
}

check_for_duplicates() {
    local dir="$1"
    local name="$2"
    
    # Get all public keys and check for duplicates
    local pubkeys=()
    local duplicates=0
    
    for file in "$dir"/*.json; do
        [[ -f "$file" ]] || continue
        
        if command -v solana-keygen &>/dev/null; then
            local pubkey
            pubkey=$(solana-keygen pubkey "$file" 2>/dev/null) || continue
            
            for existing in "${pubkeys[@]}"; do
                if [[ "$existing" == "$pubkey" ]]; then
                    log_fail "$name: Duplicate public key found: $pubkey"
                    duplicates=$((duplicates + 1))
                fi
            done
            pubkeys+=("$pubkey")
        fi
    done
    
    if [[ $duplicates -eq 0 ]]; then
        log_pass "$name: No duplicate keys (${#pubkeys[@]} unique)"
    fi
    
    return $duplicates
}

# ==============================================================================
# Test Rust Rapid Generation
# ==============================================================================

test_rust_rapid() {
    local rust_bin="$PROJECT_ROOT/rust/target/release/solana-vanity"
    
    if [[ ! -x "$rust_bin" ]]; then
        log_info "Rust binary not found, skipping"
        return 0
    fi
    
    echo -e "${CYAN}Testing Rust rapid generation...${NC}"
    
    local rust_dir="$TEMP_DIR/rust"
    mkdir -p "$rust_dir"
    
    local start_time=$(date +%s.%N)
    local errors=0
    
    for i in $(seq 1 $NUM_KEYPAIRS); do
        local outfile="$rust_dir/key-$i.json"
        if ! "$rust_bin" --prefix "a" --output "$outfile" --quiet 2>/dev/null; then
            log_fail "Rust: Generation $i failed"
            errors=$((errors + 1))
        fi
        
        # Progress indicator
        if (( i % 5 == 0 )); then
            echo "  Generated $i/$NUM_KEYPAIRS..."
        fi
    done
    
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc)
    
    echo "  Total time: ${duration}s ($(echo "scale=3; $duration / $NUM_KEYPAIRS" | bc)s per key)"
    
    # Verify all keypairs
    echo "  Verifying generated keypairs..."
    for i in $(seq 1 $NUM_KEYPAIRS); do
        local outfile="$rust_dir/key-$i.json"
        if ! verify_keypair "$outfile" "Rust key $i" 2>/dev/null; then
            errors=$((errors + 1))
        fi
    done
    
    # Check for duplicates
    check_for_duplicates "$rust_dir" "Rust" || errors=$((errors + 1))
    
    if [[ $errors -eq 0 ]]; then
        log_pass "Rust: All $NUM_KEYPAIRS keypairs generated and verified"
    else
        log_fail "Rust: $errors errors during rapid generation"
    fi
    
    return $errors
}

# ==============================================================================
# Test TypeScript Rapid Generation
# ==============================================================================

test_typescript_rapid() {
    local ts_cli="$PROJECT_ROOT/typescript/dist/index.js"
    
    if [[ ! -f "$ts_cli" ]]; then
        log_info "TypeScript CLI not found, skipping"
        return 0
    fi
    
    echo -e "${CYAN}Testing TypeScript rapid generation...${NC}"
    
    local ts_dir="$TEMP_DIR/typescript"
    mkdir -p "$ts_dir"
    
    local start_time=$(date +%s.%N)
    local errors=0
    
    for i in $(seq 1 $NUM_KEYPAIRS); do
        local outfile="$ts_dir/key-$i.json"
        if ! node "$ts_cli" --prefix "a" --output "$outfile" 2>/dev/null; then
            log_fail "TypeScript: Generation $i failed"
            errors=$((errors + 1))
        fi
        
        # Progress indicator
        if (( i % 5 == 0 )); then
            echo "  Generated $i/$NUM_KEYPAIRS..."
        fi
    done
    
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc)
    
    echo "  Total time: ${duration}s ($(echo "scale=3; $duration / $NUM_KEYPAIRS" | bc)s per key)"
    
    # Verify all keypairs
    echo "  Verifying generated keypairs..."
    for i in $(seq 1 $NUM_KEYPAIRS); do
        local outfile="$ts_dir/key-$i.json"
        if ! verify_keypair "$outfile" "TypeScript key $i" 2>/dev/null; then
            errors=$((errors + 1))
        fi
    done
    
    # Check for duplicates
    check_for_duplicates "$ts_dir" "TypeScript" || errors=$((errors + 1))
    
    if [[ $errors -eq 0 ]]; then
        log_pass "TypeScript: All $NUM_KEYPAIRS keypairs generated and verified"
    else
        log_fail "TypeScript: $errors errors during rapid generation"
    fi
    
    return $errors
}

# ==============================================================================
# Run Tests
# ==============================================================================

echo "--- Starting Rapid Generation Tests ---"
echo ""

RUST_ERRORS=0
TS_ERRORS=0

test_rust_rapid || RUST_ERRORS=$?
echo ""
test_typescript_rapid || TS_ERRORS=$?

# ==============================================================================
# Summary
# ==============================================================================

echo ""
echo "=============================================="
echo "Rapid Generation Summary"
echo "=============================================="

TOTAL_ERRORS=$((RUST_ERRORS + TS_ERRORS))

if [[ $TOTAL_ERRORS -eq 0 ]]; then
    echo -e "${GREEN}All rapid generation tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Total errors: $TOTAL_ERRORS${NC}"
    exit 1
fi
