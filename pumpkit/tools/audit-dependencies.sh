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
# TypeScript Dependencies
# ==============================================================================

echo -e "${CYAN}=== TypeScript Dependencies ===${NC}"
echo ""

if command -v npm &>/dev/null; then
    cd "$PROJECT_ROOT"

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
CURL_PIPE=$(grep -rn "curl.*|.*sh\|curl.*|.*bash\|wget.*|.*sh\|wget.*|.*bash" "$PROJECT_ROOT/" 2>/dev/null --include="*.sh" || true)
if [[ -n "$CURL_PIPE" ]]; then
    log_warn "Found 'curl | sh' pattern (potential remote code execution):"
    echo "$CURL_PIPE"
else
    log_pass "No 'curl | sh' patterns found"
fi

echo ""

# Check for eval usage
echo "2. Checking for 'eval' usage..."
EVAL_USAGE=$(grep -rn "eval " "$PROJECT_ROOT/" 2>/dev/null --include="*.sh" || true)
if [[ -n "$EVAL_USAGE" ]]; then
    log_warn "Found 'eval' usage (potential code injection):"
    echo "$EVAL_USAGE"
else
    log_pass "No 'eval' usage found"
fi

echo ""

# Check for hardcoded secrets
echo "3. Checking for potential hardcoded secrets..."
SECRETS=$(grep -rniE "(password|secret|api_key|apikey|token|private_key)\s*=" "$PROJECT_ROOT" --include="*.sh" --include="*.ts" 2>/dev/null | grep -v "test\|example\|sample\|mock\|node_modules" | head -5 || true)
if [[ -n "$SECRETS" ]]; then
    log_warn "Potential hardcoded secrets (review manually):"
    echo "$SECRETS"
else
    log_pass "No obvious hardcoded secrets found"
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
