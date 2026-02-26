#!/bin/bash
# ==============================================================================
# Comprehensive Test Runner
# ==============================================================================
# Runs all tests across all implementations with configurable iterations.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# Configuration
ITERATIONS=${1:-3}
SKIP_BUILD=${SKIP_BUILD:-0}
SKIP_FUZZ=${SKIP_FUZZ:-0}
SKIP_STRESS=${SKIP_STRESS:-0}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Results tracking
FAILED=0
PASSED=0

log_pass() { 
    echo -e "${GREEN}✓ PASS${NC}: $1"
    PASSED=$((PASSED+1))
}

log_fail() { 
    echo -e "${RED}✗ FAIL${NC}: $1"
    FAILED=$((FAILED+1))
}

log_info() { 
    echo -e "${YELLOW}→${NC} $1"
}

log_section() {
    echo ""
    echo -e "${CYAN}${BOLD}=== $1 ===${NC}"
    echo ""
}

echo "=========================================="
echo "Solana Vanity Address Generator"
echo "Comprehensive Test Suite"
echo "=========================================="
echo ""
echo "Configuration:"
echo "  Iterations per test: $ITERATIONS"
echo "  Skip build: $SKIP_BUILD"
echo "  Skip fuzz tests: $SKIP_FUZZ"
echo "  Skip stress tests: $SKIP_STRESS"
echo ""

# ==============================================================================
# Build Phase
# ==============================================================================

if [[ "$SKIP_BUILD" -eq 0 ]]; then
    log_section "Building All Implementations"
    
    # Build Rust
    echo "Building Rust implementation..."
    if cd "$PROJECT_ROOT/rust" && cargo build --release 2>&1; then
        log_pass "Rust build"
    else
        log_fail "Rust build"
    fi
    cd "$PROJECT_ROOT"
    
    # Build TypeScript
    echo "Building TypeScript implementation..."
    if cd "$PROJECT_ROOT/typescript" && npm install --silent 2>&1 && npm run build 2>&1; then
        log_pass "TypeScript build"
    else
        log_fail "TypeScript build"
    fi
    cd "$PROJECT_ROOT"
else
    log_info "Skipping build phase"
fi

# ==============================================================================
# Unit Tests
# ==============================================================================

log_section "Running Unit Tests ($ITERATIONS iterations)"

# Rust unit tests
echo -e "${BOLD}--- Rust Unit Tests ---${NC}"
for i in $(seq 1 $ITERATIONS); do
    if cd "$PROJECT_ROOT/rust" && cargo test --release 2>&1 | tail -5; then
        log_pass "Rust unit tests (run $i)"
    else
        log_fail "Rust unit tests (run $i)"
    fi
    cd "$PROJECT_ROOT"
done

# TypeScript unit tests
echo ""
echo -e "${BOLD}--- TypeScript Unit Tests ---${NC}"
for i in $(seq 1 $ITERATIONS); do
    if cd "$PROJECT_ROOT/typescript" && npm test 2>&1 | tail -10; then
        log_pass "TypeScript unit tests (run $i)"
    else
        log_fail "TypeScript unit tests (run $i)"
    fi
    cd "$PROJECT_ROOT"
done

# ==============================================================================
# Integration Tests
# ==============================================================================

log_section "Running Integration Tests"

# Make integration test scripts executable
chmod +x "$PROJECT_ROOT/tests/integration/"*.sh 2>/dev/null || true

# Output compatibility test
echo -e "${BOLD}--- Output Compatibility ---${NC}"
for i in $(seq 1 $ITERATIONS); do
    if "$PROJECT_ROOT/tests/integration/test_output_compatibility.sh" 2>&1 | tail -10; then
        log_pass "Output compatibility (run $i)"
    else
        log_fail "Output compatibility (run $i)"
    fi
done

# Keypair validity test
echo ""
echo -e "${BOLD}--- Keypair Validity ---${NC}"
for i in $(seq 1 $ITERATIONS); do
    if "$PROJECT_ROOT/tests/integration/test_keypair_validity.sh" 2>&1 | tail -10; then
        log_pass "Keypair validity (run $i)"
    else
        log_fail "Keypair validity (run $i)"
    fi
done

# Security properties test
echo ""
echo -e "${BOLD}--- Security Properties ---${NC}"
if "$PROJECT_ROOT/tests/integration/test_security_properties.sh" 2>&1; then
    log_pass "Security properties"
else
    log_fail "Security properties"
fi

# ==============================================================================
# Fuzz Tests
# ==============================================================================

if [[ "$SKIP_FUZZ" -eq 0 ]]; then
    log_section "Running Fuzz Tests"
    
    # Input validation fuzz
    echo -e "${BOLD}--- Input Validation Fuzz ---${NC}"
    if python3 "$PROJECT_ROOT/tests/fuzz/fuzz_validation.py" 2>&1 | tail -20; then
        log_pass "Input validation fuzz"
    else
        log_fail "Input validation fuzz"
    fi
    
    # File operations fuzz
    echo ""
    echo -e "${BOLD}--- File Operations Fuzz ---${NC}"
    if python3 "$PROJECT_ROOT/tests/fuzz/fuzz_file_operations.py" 2>&1 | tail -20; then
        log_pass "File operations fuzz"
    else
        log_fail "File operations fuzz"
    fi
else
    log_info "Skipping fuzz tests"
fi

# ==============================================================================
# Stress Tests (optional)
# ==============================================================================

if [[ "$SKIP_STRESS" -eq 0 ]]; then
    log_section "Running Stress Tests"
    
    # Make stress test scripts executable
    chmod +x "$PROJECT_ROOT/tests/stress/"*.sh 2>/dev/null || true
    
    # Rapid generation
    echo -e "${BOLD}--- Rapid Generation (10 keys) ---${NC}"
    if "$PROJECT_ROOT/tests/stress/rapid_generation.sh" 10 2>&1 | tail -15; then
        log_pass "Rapid generation"
    else
        log_fail "Rapid generation"
    fi
else
    log_info "Skipping stress tests"
fi

# ==============================================================================
# Dependency Audit
# ==============================================================================

log_section "Running Dependency Audit"

chmod +x "$PROJECT_ROOT/tools/"*.sh 2>/dev/null || true

if "$PROJECT_ROOT/tools/audit-dependencies.sh" 2>&1 | tail -20; then
    log_pass "Dependency audit"
else
    log_fail "Dependency audit"
fi

# ==============================================================================
# Summary
# ==============================================================================

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo ""
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "Total:  $((PASSED + FAILED))"
echo ""

if [[ $FAILED -eq 0 ]]; then
    echo -e "${GREEN}${BOLD}All tests passed!${NC}"
    echo ""
    echo "The codebase is ready for production use."
    exit 0
else
    echo -e "${RED}${BOLD}$FAILED test(s) failed${NC}"
    echo ""
    echo "Please review the failures above and fix before releasing."
    exit 1
fi
