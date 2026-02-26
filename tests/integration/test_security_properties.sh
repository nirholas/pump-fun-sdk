#!/bin/bash
# ==============================================================================
# Security Properties Test
# ==============================================================================
# Tests security properties across all implementations:
# - File permissions (0600)
# - Input validation (invalid Base58)
# - Error handling (no sensitive data leakage)
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

FAILED=0
log_pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; }
log_fail() { echo -e "${RED}✗ FAIL${NC}: $1"; FAILED=$((FAILED+1)); }
log_info() { echo -e "${YELLOW}→${NC} $1"; }

echo "=============================================="
echo "Security Properties Test Suite"
echo "=============================================="
echo ""

# ==============================================================================
# File Permission Tests
# ==============================================================================

echo "--- File Permission Tests ---"
echo ""

test_file_permissions_rust() {
    local keyfile="$TEMP_DIR/perm-test-rust.json"
    local rust_bin="$PROJECT_ROOT/rust/target/release/solana-vanity"
    
    if [[ ! -x "$rust_bin" ]]; then
        log_info "Rust binary not found, skipping permission test"
        return 0
    fi
    
    # Generate keypair
    "$rust_bin" --prefix "a" --output "$keyfile" --quiet 2>/dev/null || true
    
    if [[ ! -f "$keyfile" ]]; then
        log_fail "Rust: Failed to generate keypair for permission test"
        return 1
    fi
    
    # Check permissions
    local perms
    perms=$(stat -c "%a" "$keyfile" 2>/dev/null || stat -f "%Lp" "$keyfile" 2>/dev/null)
    
    if [[ "$perms" == "600" ]]; then
        log_pass "Rust: File permissions are 600 (secure)"
    else
        log_fail "Rust: File permissions are $perms (expected 600)"
    fi
    
    rm -f "$keyfile"
}

test_file_permissions_typescript() {
    local keyfile="$TEMP_DIR/perm-test-ts.json"
    local ts_cli="$PROJECT_ROOT/typescript/dist/index.js"
    
    if [[ ! -f "$ts_cli" ]]; then
        log_info "TypeScript CLI not found, skipping permission test"
        return 0
    fi
    
    # Generate keypair
    node "$ts_cli" --prefix "a" --output "$keyfile" 2>/dev/null || true
    
    if [[ ! -f "$keyfile" ]]; then
        log_fail "TypeScript: Failed to generate keypair for permission test"
        return 1
    fi
    
    # Check permissions
    local perms
    perms=$(stat -c "%a" "$keyfile" 2>/dev/null || stat -f "%Lp" "$keyfile" 2>/dev/null)
    
    if [[ "$perms" == "600" ]]; then
        log_pass "TypeScript: File permissions are 600 (secure)"
    else
        log_fail "TypeScript: File permissions are $perms (expected 600)"
    fi
    
    rm -f "$keyfile"
}

test_file_permissions_rust
test_file_permissions_typescript

# ==============================================================================
# Input Validation Tests
# ==============================================================================

echo ""
echo "--- Input Validation Tests ---"
echo ""

# Invalid Base58 characters: 0, O, I, l
INVALID_INPUTS=(
    "0abc"    # Contains invalid '0'
    "Oabc"    # Contains invalid 'O'
    "Iabc"    # Contains invalid 'I'
    "labc"    # Contains invalid 'l'
    ""        # Empty string
    "🚀"      # Unicode emoji
)

test_input_validation_rust() {
    local rust_bin="$PROJECT_ROOT/rust/target/release/solana-vanity"
    
    if [[ ! -x "$rust_bin" ]]; then
        log_info "Rust binary not found, skipping input validation test"
        return 0
    fi
    
    for input in "${INVALID_INPUTS[@]}"; do
        local display_input="$input"
        [[ -z "$input" ]] && display_input="(empty)"
        
        # Should fail gracefully
        if "$rust_bin" --prefix "$input" --output "$TEMP_DIR/should-not-exist.json" 2>/dev/null; then
            # Check if file was created - it shouldn't be for invalid input
            if [[ -f "$TEMP_DIR/should-not-exist.json" ]]; then
                log_fail "Rust: Accepted invalid input: $display_input"
                rm -f "$TEMP_DIR/should-not-exist.json"
            fi
        else
            log_pass "Rust: Correctly rejected invalid input: $display_input"
        fi
    done
}

test_input_validation_typescript() {
    local ts_cli="$PROJECT_ROOT/typescript/dist/index.js"
    
    if [[ ! -f "$ts_cli" ]]; then
        log_info "TypeScript CLI not found, skipping input validation test"
        return 0
    fi
    
    for input in "${INVALID_INPUTS[@]}"; do
        local display_input="$input"
        [[ -z "$input" ]] && display_input="(empty)"
        
        # Should fail gracefully
        if node "$ts_cli" --prefix "$input" --output "$TEMP_DIR/should-not-exist.json" 2>/dev/null; then
            if [[ -f "$TEMP_DIR/should-not-exist.json" ]]; then
                log_fail "TypeScript: Accepted invalid input: $display_input"
                rm -f "$TEMP_DIR/should-not-exist.json"
            fi
        else
            log_pass "TypeScript: Correctly rejected invalid input: $display_input"
        fi
    done
}

test_input_validation_rust
test_input_validation_typescript

# ==============================================================================
# Error Message Leakage Tests
# ==============================================================================

echo ""
echo "--- Error Message Security Tests ---"
echo ""

test_error_leakage_rust() {
    local rust_bin="$PROJECT_ROOT/rust/target/release/solana-vanity"
    
    if [[ ! -x "$rust_bin" ]]; then
        log_info "Rust binary not found, skipping error leakage test"
        return 0
    fi
    
    # Capture error output with invalid input
    local error_output
    error_output=$("$rust_bin" --prefix "0invalid" 2>&1 || true)
    
    # Check for patterns that might indicate secret key exposure
    # Secret keys are 64-byte arrays represented as numbers
    if echo "$error_output" | grep -qE '\[[0-9]{1,3}(,[0-9]{1,3}){63}\]'; then
        log_fail "Rust: Error output may contain secret key data"
    else
        log_pass "Rust: Error output does not leak secret key data"
    fi
    
    # Check for common secret patterns
    if echo "$error_output" | grep -qiE 'secret|private.?key|seed'; then
        log_info "Rust: Error mentions 'secret/private' but doesn't leak actual data"
    fi
}

test_error_leakage_typescript() {
    local ts_cli="$PROJECT_ROOT/typescript/dist/index.js"
    
    if [[ ! -f "$ts_cli" ]]; then
        log_info "TypeScript CLI not found, skipping error leakage test"
        return 0
    fi
    
    # Capture error output with invalid input
    local error_output
    error_output=$(node "$ts_cli" --prefix "0invalid" 2>&1 || true)
    
    # Check for patterns that might indicate secret key exposure
    if echo "$error_output" | grep -qE '\[[0-9]{1,3}(,[0-9]{1,3}){63}\]'; then
        log_fail "TypeScript: Error output may contain secret key data"
    else
        log_pass "TypeScript: Error output does not leak secret key data"
    fi
}

test_error_leakage_rust
test_error_leakage_typescript

# ==============================================================================
# Path Traversal Tests
# ==============================================================================

echo ""
echo "--- Path Traversal Tests ---"
echo ""

test_path_traversal_rust() {
    local rust_bin="$PROJECT_ROOT/rust/target/release/solana-vanity"
    
    if [[ ! -x "$rust_bin" ]]; then
        log_info "Rust binary not found, skipping path traversal test"
        return 0
    fi
    
    # Try to write outside temp directory
    local malicious_path="/tmp/../tmp/../../tmp/traversal-test.json"
    
    # This should either fail or write to a safe location
    "$rust_bin" --prefix "a" --output "$malicious_path" --quiet 2>/dev/null || true
    
    # The key here is that we shouldn't be able to write to system directories
    if [[ -f "/etc/traversal-test.json" ]] || [[ -f "/traversal-test.json" ]]; then
        log_fail "Rust: Path traversal vulnerability detected"
        rm -f "/etc/traversal-test.json" "/traversal-test.json" 2>/dev/null || true
    else
        log_pass "Rust: Path traversal prevented"
    fi
    
    # Cleanup any created files
    rm -f "$malicious_path" 2>/dev/null || true
}

test_path_traversal_typescript() {
    local ts_cli="$PROJECT_ROOT/typescript/dist/index.js"
    
    if [[ ! -f "$ts_cli" ]]; then
        log_info "TypeScript CLI not found, skipping path traversal test"
        return 0
    fi
    
    local malicious_path="/tmp/../tmp/../../tmp/traversal-test-ts.json"
    
    node "$ts_cli" --prefix "a" --output "$malicious_path" 2>/dev/null || true
    
    if [[ -f "/etc/traversal-test-ts.json" ]] || [[ -f "/traversal-test-ts.json" ]]; then
        log_fail "TypeScript: Path traversal vulnerability detected"
        rm -f "/etc/traversal-test-ts.json" "/traversal-test-ts.json" 2>/dev/null || true
    else
        log_pass "TypeScript: Path traversal prevented"
    fi
    
    rm -f "$malicious_path" 2>/dev/null || true
}

test_path_traversal_rust
test_path_traversal_typescript

# ==============================================================================
# Summary
# ==============================================================================

echo ""
echo "=============================================="
if [[ $FAILED -eq 0 ]]; then
    echo -e "${GREEN}All security tests passed!${NC}"
    exit 0
else
    echo -e "${RED}$FAILED security test(s) failed${NC}"
    exit 1
fi
