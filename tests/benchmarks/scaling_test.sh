#!/bin/bash
# ==============================================================================
# Performance Scaling Test
# ==============================================================================
# Tests how performance scales with prefix length across implementations.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

echo "=============================================="
echo "Performance Scaling Test"
echo "=============================================="
echo ""
echo "Testing how generation time scales with prefix length."
echo ""

# Valid Base58 characters for generating random prefixes
BASE58_CHARS="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

# Maximum timeout per attempt (seconds)
MAX_TIMEOUT=60

# ==============================================================================
# Helper Functions
# ==============================================================================

generate_random_prefix() {
    local length="$1"
    local prefix=""
    for ((i = 0; i < length; i++)); do
        local idx=$((RANDOM % ${#BASE58_CHARS}))
        prefix="${prefix}${BASE58_CHARS:$idx:1}"
    done
    echo "$prefix"
}

measure_with_timeout() {
    local timeout="$1"
    shift
    
    local start end duration
    start=$(date +%s.%N)
    
    if timeout "$timeout" "$@" >/dev/null 2>&1; then
        end=$(date +%s.%N)
        duration=$(echo "$end - $start" | bc)
        echo "$duration"
    else
        echo "timeout"
    fi
}

format_time() {
    local time="$1"
    if [[ "$time" == "timeout" ]]; then
        echo ">$(echo "$MAX_TIMEOUT")s"
    else
        printf "%.3fs" "$time"
    fi
}

# ==============================================================================
# Test Functions
# ==============================================================================

test_scaling_rust() {
    local rust_bin="$PROJECT_ROOT/rust/target/release/solana-vanity"
    
    if [[ ! -x "$rust_bin" ]]; then
        echo "  ⚠️  Rust binary not found, skipping"
        return
    fi
    
    echo -e "${CYAN}Rust Implementation:${NC}"
    printf "  %-10s %-15s %-15s\n" "Length" "Prefix" "Time"
    printf "  %-10s %-15s %-15s\n" "------" "------" "----"
    
    for len in 1 2 3 4; do
        local prefix
        prefix=$(generate_random_prefix "$len")
        local outfile="$TEMP_DIR/rust-scale-$len.json"
        
        local time
        time=$(measure_with_timeout "$MAX_TIMEOUT" "$rust_bin" --prefix "$prefix" --output "$outfile" --quiet)
        
        printf "  %-10s %-15s %-15s\n" "$len" "$prefix" "$(format_time "$time")"
        
        rm -f "$outfile" 2>/dev/null || true
    done
    echo ""
}

test_scaling_typescript() {
    local ts_cli="$PROJECT_ROOT/typescript/dist/index.js"
    
    if [[ ! -f "$ts_cli" ]]; then
        echo "  ⚠️  TypeScript CLI not found, skipping"
        return
    fi
    
    echo -e "${CYAN}TypeScript Implementation:${NC}"
    printf "  %-10s %-15s %-15s\n" "Length" "Prefix" "Time"
    printf "  %-10s %-15s %-15s\n" "------" "------" "----"
    
    for len in 1 2 3; do  # TypeScript is slower, limit to 3 chars
        local prefix
        prefix=$(generate_random_prefix "$len")
        local outfile="$TEMP_DIR/ts-scale-$len.json"
        
        local time
        time=$(measure_with_timeout "$MAX_TIMEOUT" node "$ts_cli" --prefix "$prefix" --output "$outfile")
        
        printf "  %-10s %-15s %-15s\n" "$len" "$prefix" "$(format_time "$time")"
        
        rm -f "$outfile" 2>/dev/null || true
    done
    echo ""
}

test_scaling_cli() {
    if ! command -v solana-keygen &>/dev/null; then
        echo "  ⚠️  solana-keygen not found, skipping"
        return
    fi
    
    echo -e "${CYAN}CLI (solana-keygen grind):${NC}"
    printf "  %-10s %-15s %-15s\n" "Length" "Prefix" "Time"
    printf "  %-10s %-15s %-15s\n" "------" "------" "----"
    
    for len in 1 2 3 4; do
        local prefix
        prefix=$(generate_random_prefix "$len")
        
        cd "$TEMP_DIR"
        
        local time
        time=$(measure_with_timeout "$MAX_TIMEOUT" solana-keygen grind --starts-with "${prefix}:1" --no-bip39-passphrase)
        
        printf "  %-10s %-15s %-15s\n" "$len" "$prefix" "$(format_time "$time")"
        
        rm -f "${prefix}"*.json 2>/dev/null || true
    done
    echo ""
}

# ==============================================================================
# Run Tests
# ==============================================================================

echo -e "${BOLD}Expected Scaling:${NC}"
echo "  Each additional character multiplies search space by ~58x"
echo "  1 char: ~58 attempts average"
echo "  2 char: ~3,364 attempts average"
echo "  3 char: ~195,112 attempts average"
echo "  4 char: ~11,316,496 attempts average"
echo ""
echo "  Timeout: ${MAX_TIMEOUT}s per attempt"
echo ""

echo "--- Running Scaling Tests ---"
echo ""

test_scaling_cli
test_scaling_rust
test_scaling_typescript

# ==============================================================================
# Summary
# ==============================================================================

echo "=============================================="
echo -e "${BOLD}Scaling Analysis${NC}"
echo "=============================================="
echo ""
echo "Time complexity: O(58^n) where n = prefix length"
echo ""
echo "Guidelines for prefix selection:"
echo "  - 1-2 chars: Instant (<1s)"
echo "  - 3 chars: Fast (seconds)"
echo "  - 4 chars: Moderate (minutes)"
echo "  - 5 chars: Long (hours)"
echo "  - 6+ chars: Very long (days+)"
echo ""
echo "Note: Actual times depend on system performance and luck."
