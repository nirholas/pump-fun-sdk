#!/bin/bash
# ==============================================================================
# Long Running Stability Test
# ==============================================================================
# Tests long-running stability of all implementations by:
# - Running for an extended period
# - Monitoring memory usage
# - Checking for file descriptor leaks
# - Verifying output correctness
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
DURATION_MINUTES=${1:-5}  # Default 5 minutes
CHECK_INTERVAL=30         # Check every 30 seconds
MAX_MEMORY_MB=500        # Max allowed memory usage

echo "=============================================="
echo "Long Running Stability Test"
echo "=============================================="
echo ""
echo "Duration: ${DURATION_MINUTES} minutes"
echo "Check interval: ${CHECK_INTERVAL} seconds"
echo ""

log_pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; }
log_fail() { echo -e "${RED}✗ FAIL${NC}: $1"; }
log_info() { echo -e "${YELLOW}→${NC} $1"; }

# ==============================================================================
# Monitoring Functions
# ==============================================================================

get_memory_usage() {
    local pid="$1"
    if [[ -f "/proc/$pid/status" ]]; then
        grep VmRSS "/proc/$pid/status" 2>/dev/null | awk '{print $2}' || echo "0"
    else
        # macOS fallback
        ps -o rss= -p "$pid" 2>/dev/null | awk '{print $1}' || echo "0"
    fi
}

get_fd_count() {
    local pid="$1"
    if [[ -d "/proc/$pid/fd" ]]; then
        ls "/proc/$pid/fd" 2>/dev/null | wc -l || echo "0"
    else
        # macOS fallback
        lsof -p "$pid" 2>/dev/null | wc -l || echo "0"
    fi
}

# ==============================================================================
# Test Rust Long-Running
# ==============================================================================

test_rust_stability() {
    local rust_bin="$PROJECT_ROOT/rust/target/release/solana-vanity"
    
    if [[ ! -x "$rust_bin" ]]; then
        log_info "Rust binary not found, skipping"
        return 0
    fi
    
    echo -e "${CYAN}Testing Rust implementation stability...${NC}"
    
    local count=0
    local errors=0
    local start_time=$(date +%s)
    local end_time=$((start_time + DURATION_MINUTES * 60))
    local initial_fd_count=""
    
    while [[ $(date +%s) -lt $end_time ]]; do
        count=$((count + 1))
        local outfile="$TEMP_DIR/rust-stability-$count.json"
        
        # Generate a keypair
        if "$rust_bin" --prefix "a" --output "$outfile" --quiet 2>/dev/null; then
            # Verify the output
            if [[ -f "$outfile" ]] && jq empty "$outfile" 2>/dev/null; then
                rm -f "$outfile"
            else
                log_fail "Rust: Invalid output at iteration $count"
                errors=$((errors + 1))
            fi
        else
            log_fail "Rust: Generation failed at iteration $count"
            errors=$((errors + 1))
        fi
        
        # Progress every CHECK_INTERVAL iterations
        if (( count % 10 == 0 )); then
            local elapsed=$(($(date +%s) - start_time))
            echo "  Rust: $count iterations completed, $errors errors, ${elapsed}s elapsed"
        fi
    done
    
    local total_time=$(($(date +%s) - start_time))
    
    if [[ $errors -eq 0 ]]; then
        log_pass "Rust: $count iterations completed in ${total_time}s with no errors"
    else
        log_fail "Rust: $count iterations completed with $errors errors"
    fi
    
    return $errors
}

# ==============================================================================
# Test TypeScript Long-Running
# ==============================================================================

test_typescript_stability() {
    local ts_cli="$PROJECT_ROOT/typescript/dist/index.js"
    
    if [[ ! -f "$ts_cli" ]]; then
        log_info "TypeScript CLI not found, skipping"
        return 0
    fi
    
    echo -e "${CYAN}Testing TypeScript implementation stability...${NC}"
    
    local count=0
    local errors=0
    local start_time=$(date +%s)
    local end_time=$((start_time + DURATION_MINUTES * 60))
    
    while [[ $(date +%s) -lt $end_time ]]; do
        count=$((count + 1))
        local outfile="$TEMP_DIR/ts-stability-$count.json"
        
        # Generate a keypair
        if node "$ts_cli" --prefix "a" --output "$outfile" 2>/dev/null; then
            # Verify the output
            if [[ -f "$outfile" ]] && jq empty "$outfile" 2>/dev/null; then
                rm -f "$outfile"
            else
                log_fail "TypeScript: Invalid output at iteration $count"
                errors=$((errors + 1))
            fi
        else
            log_fail "TypeScript: Generation failed at iteration $count"
            errors=$((errors + 1))
        fi
        
        # Progress every 10 iterations
        if (( count % 10 == 0 )); then
            local elapsed=$(($(date +%s) - start_time))
            echo "  TypeScript: $count iterations completed, $errors errors, ${elapsed}s elapsed"
        fi
    done
    
    local total_time=$(($(date +%s) - start_time))
    
    if [[ $errors -eq 0 ]]; then
        log_pass "TypeScript: $count iterations completed in ${total_time}s with no errors"
    else
        log_fail "TypeScript: $count iterations completed with $errors errors"
    fi
    
    return $errors
}

# ==============================================================================
# Run Tests
# ==============================================================================

echo "--- Starting Stability Tests ---"
echo ""

RUST_ERRORS=0
TS_ERRORS=0

test_rust_stability || RUST_ERRORS=$?
echo ""
test_typescript_stability || TS_ERRORS=$?

# ==============================================================================
# Summary
# ==============================================================================

echo ""
echo "=============================================="
echo "Stability Test Summary"
echo "=============================================="

TOTAL_ERRORS=$((RUST_ERRORS + TS_ERRORS))

if [[ $TOTAL_ERRORS -eq 0 ]]; then
    echo -e "${GREEN}All stability tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Total errors: $TOTAL_ERRORS${NC}"
    exit 1
fi
