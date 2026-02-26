#!/bin/bash
# ==============================================================================
# Performance Comparison Test
# ==============================================================================
# Compares generation speed across all implementations.
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
echo "Performance Comparison - All Implementations"
echo "=============================================="
echo ""

# Test configurations
TEST_PREFIX="ab"
ITERATIONS=3

# Results storage
declare -A RESULTS

# ==============================================================================
# Helper Functions
# ==============================================================================

measure_time() {
    local start end duration
    start=$(date +%s.%N)
    "$@" >/dev/null 2>&1
    end=$(date +%s.%N)
    duration=$(echo "$end - $start" | bc)
    echo "$duration"
}

format_time() {
    local time="$1"
    printf "%.3fs" "$time"
}

calculate_avg() {
    local sum=0
    local count=0
    for val in "$@"; do
        sum=$(echo "$sum + $val" | bc)
        count=$((count + 1))
    done
    echo "scale=3; $sum / $count" | bc
}

# ==============================================================================
# Test Functions
# ==============================================================================

test_cli() {
    echo -e "${CYAN}Testing CLI (solana-keygen grind)...${NC}"
    
    if ! command -v solana-keygen &>/dev/null; then
        echo "  ⚠️  solana-keygen not found, skipping"
        return
    fi
    
    local times=()
    for i in $(seq 1 $ITERATIONS); do
        cd "$TEMP_DIR"
        local time
        time=$(measure_time solana-keygen grind --starts-with "${TEST_PREFIX}:1" --no-bip39-passphrase)
        times+=("$time")
        rm -f "${TEST_PREFIX}"*.json 2>/dev/null || true
        echo "    Run $i: $(format_time "$time")"
    done
    
    local avg
    avg=$(calculate_avg "${times[@]}")
    RESULTS["CLI"]="$avg"
    echo -e "  ${GREEN}Average: $(format_time "$avg")${NC}"
    echo ""
}

test_rust() {
    echo -e "${CYAN}Testing Rust implementation...${NC}"
    
    local rust_bin="$PROJECT_ROOT/rust/target/release/solana-vanity"
    if [[ ! -x "$rust_bin" ]]; then
        echo "  ⚠️  Rust binary not found, skipping (run 'cargo build --release')"
        return
    fi
    
    local times=()
    for i in $(seq 1 $ITERATIONS); do
        local outfile="$TEMP_DIR/rust-perf-$i.json"
        local time
        time=$(measure_time "$rust_bin" --prefix "$TEST_PREFIX" --output "$outfile" --quiet)
        times+=("$time")
        rm -f "$outfile" 2>/dev/null || true
        echo "    Run $i: $(format_time "$time")"
    done
    
    local avg
    avg=$(calculate_avg "${times[@]}")
    RESULTS["Rust"]="$avg"
    echo -e "  ${GREEN}Average: $(format_time "$avg")${NC}"
    echo ""
}

test_typescript() {
    echo -e "${CYAN}Testing TypeScript implementation...${NC}"
    
    local ts_cli="$PROJECT_ROOT/typescript/dist/index.js"
    if [[ ! -f "$ts_cli" ]]; then
        echo "  ⚠️  TypeScript CLI not found, skipping (run 'npm run build')"
        return
    fi
    
    local times=()
    for i in $(seq 1 $ITERATIONS); do
        local outfile="$TEMP_DIR/ts-perf-$i.json"
        local time
        time=$(measure_time node "$ts_cli" --prefix "$TEST_PREFIX" --output "$outfile")
        times+=("$time")
        rm -f "$outfile" 2>/dev/null || true
        echo "    Run $i: $(format_time "$time")"
    done
    
    local avg
    avg=$(calculate_avg "${times[@]}")
    RESULTS["TypeScript"]="$avg"
    echo -e "  ${GREEN}Average: $(format_time "$avg")${NC}"
    echo ""
}

# ==============================================================================
# Run Tests
# ==============================================================================

echo -e "${BOLD}Test Configuration:${NC}"
echo "  Prefix: '$TEST_PREFIX' (${#TEST_PREFIX} chars)"
echo "  Iterations: $ITERATIONS per implementation"
echo ""

echo "--- Running Benchmarks ---"
echo ""

test_cli
test_rust
test_typescript

# ==============================================================================
# Summary
# ==============================================================================

echo "=============================================="
echo -e "${BOLD}Performance Summary${NC}"
echo "=============================================="
echo ""
echo "Prefix: '$TEST_PREFIX' (${#TEST_PREFIX} characters)"
echo ""

printf "%-15s %12s\n" "Implementation" "Avg Time"
printf "%-15s %12s\n" "---------------" "------------"

for impl in "CLI" "Rust" "TypeScript"; do
    if [[ -n "${RESULTS[$impl]:-}" ]]; then
        printf "%-15s %12s\n" "$impl" "$(format_time "${RESULTS[$impl]}")"
    else
        printf "%-15s %12s\n" "$impl" "N/A"
    fi
done

echo ""

# Find fastest
fastest=""
fastest_time=999999
for impl in "${!RESULTS[@]}"; do
    if (( $(echo "${RESULTS[$impl]} < $fastest_time" | bc -l) )); then
        fastest="$impl"
        fastest_time="${RESULTS[$impl]}"
    fi
done

if [[ -n "$fastest" ]]; then
    echo -e "${GREEN}Fastest: $fastest ($(format_time "$fastest_time"))${NC}"
fi

echo ""
echo "Note: Times vary based on system load and randomness of finding matches."
echo "For accurate benchmarks, run multiple times and with longer prefixes."
