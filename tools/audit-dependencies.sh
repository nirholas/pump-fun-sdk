#!/bin/bash
# ==============================================================================
# Dependency Audit Tool
# ==============================================================================
# Audits all project dependencies for known vulnerabilities.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

FAILED=0

log_pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; }
log_fail() { echo -e "${RED}✗ FAIL${NC}: $1"; FAILED=$((FAILED+1)); }
log_warn() { echo -e "${YELLOW}⚠ WARN${NC}: $1"; }
log_info() { echo -e "${CYAN}→${NC} $1"; }

echo "=============================================="
echo "Dependency Security Audit"
echo "=============================================="
echo ""

# ==============================================================================
# Rust Dependencies
# ==============================================================================

echo -e "${CYAN}=== Rust Dependencies ===${NC}"
echo ""

if command -v cargo &>/dev/null; then
    cd "$PROJECT_ROOT/rust"
    
    # Check if cargo-audit is installed
    if cargo audit --version &>/dev/null; then
        echo "Running cargo audit..."
        if cargo audit 2>&1; then
            log_pass "Rust: No known vulnerabilities found"
        else
            log_fail "Rust: Vulnerabilities detected (see above)"
        fi
    else
        log_warn "cargo-audit not installed. Install with: cargo install cargo-audit"
        echo "Skipping Rust vulnerability scan"
    fi
    
    echo ""
    
    # Check for outdated dependencies
    if cargo outdated --version &>/dev/null; then
        echo "Checking for outdated dependencies..."
        cargo outdated --root-deps-only 2>&1 || true
    else
        log_info "cargo-outdated not installed (optional)"
    fi
    
    cd "$PROJECT_ROOT"
else
    log_warn "Cargo not found, skipping Rust audit"
fi

echo ""

# ==============================================================================
# TypeScript Dependencies
# ==============================================================================

echo -e "${CYAN}=== TypeScript Dependencies ===${NC}"
echo ""

if command -v npm &>/dev/null; then
    cd "$PROJECT_ROOT/typescript"
    
    echo "Running npm audit..."
    if npm audit --audit-level=high 2>&1; then
        log_pass "TypeScript: No high/critical vulnerabilities found"
    else
        log_fail "TypeScript: Vulnerabilities detected (see above)"
    fi
    
    echo ""
    
    # Check for outdated dependencies
    echo "Checking for outdated dependencies..."
    npm outdated 2>&1 || true
    
    cd "$PROJECT_ROOT"
else
    log_warn "npm not found, skipping TypeScript audit"
fi

echo ""

# ==============================================================================
# Shell Script Security Check
# ==============================================================================

echo -e "${CYAN}=== Shell Script Security ===${NC}"
echo ""

echo "Checking for potentially dangerous patterns..."
echo ""

# Check for curl | sh (remote code execution)
echo "1. Checking for 'curl | sh' patterns..."
CURL_PIPE=$(grep -rn "curl.*|.*sh\|curl.*|.*bash\|wget.*|.*sh\|wget.*|.*bash" "$PROJECT_ROOT/scripts/" 2>/dev/null || true)
if [[ -n "$CURL_PIPE" ]]; then
    log_warn "Found 'curl | sh' pattern (potential remote code execution):"
    echo "$CURL_PIPE"
else
    log_pass "No 'curl | sh' patterns found"
fi

echo ""

# Check for eval usage
echo "2. Checking for 'eval' usage..."
EVAL_USAGE=$(grep -rn "eval " "$PROJECT_ROOT/scripts/" 2>/dev/null || true)
if [[ -n "$EVAL_USAGE" ]]; then
    log_warn "Found 'eval' usage (potential code injection):"
    echo "$EVAL_USAGE"
else
    log_pass "No 'eval' usage found"
fi

echo ""

# Check for unquoted variables
echo "3. Checking for unquoted variable expansions..."
UNQUOTED=$(grep -rn '\$[A-Za-z_][A-Za-z0-9_]*[^"]' "$PROJECT_ROOT/scripts/" 2>/dev/null | grep -v '"\$' | grep -v "'" | head -10 || true)
if [[ -n "$UNQUOTED" ]]; then
    log_info "Potential unquoted variables (may be intentional):"
    echo "$UNQUOTED"
    echo "  ... (showing first 10)"
else
    log_pass "Variable quoting looks good"
fi

echo ""

# Check for hardcoded secrets
echo "4. Checking for potential hardcoded secrets..."
SECRETS=$(grep -rniE "(password|secret|api_key|apikey|token|private_key)\s*=" "$PROJECT_ROOT" --include="*.sh" --include="*.ts" --include="*.rs" 2>/dev/null | grep -v "test\|example\|sample\|mock" | head -5 || true)
if [[ -n "$SECRETS" ]]; then
    log_warn "Potential hardcoded secrets (review manually):"
    echo "$SECRETS"
else
    log_pass "No obvious hardcoded secrets found"
fi

echo ""

# ==============================================================================
# License Check
# ==============================================================================

echo -e "${CYAN}=== License Compliance ===${NC}"
echo ""

echo "Checking Rust dependencies..."
if command -v cargo &>/dev/null && command -v cargo-license &>/dev/null; then
    cd "$PROJECT_ROOT/rust"
    cargo license 2>&1 | head -20 || true
    echo "  ..."
    cd "$PROJECT_ROOT"
else
    log_info "cargo-license not installed (optional)"
fi

echo ""
echo "Checking TypeScript dependencies..."
if command -v npx &>/dev/null; then
    cd "$PROJECT_ROOT/typescript"
    npx license-checker --summary 2>/dev/null || log_info "license-checker not available"
    cd "$PROJECT_ROOT"
fi

# ==============================================================================
# Summary
# ==============================================================================

echo ""
echo "=============================================="
echo "Audit Summary"
echo "=============================================="

if [[ $FAILED -eq 0 ]]; then
    echo -e "${GREEN}All security audits passed!${NC}"
    echo ""
    echo "Recommendations:"
    echo "  - Run this audit regularly (e.g., before each release)"
    echo "  - Keep dependencies updated"
    echo "  - Review any warnings above"
    exit 0
else
    echo -e "${RED}$FAILED security issue(s) found${NC}"
    echo ""
    echo "Action required:"
    echo "  - Review and fix the issues listed above"
    echo "  - Update vulnerable dependencies"
    echo "  - Re-run this audit"
    exit 1
fi
