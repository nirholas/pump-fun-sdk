#!/bin/bash
# ==============================================================================
# Solana Keypair Verification Script
# ==============================================================================
# Verify a generated keypair is valid and matches expected prefix/suffix
# Features:
# - Load keypair from JSON file
# - Verify public key derivation
# - Confirm prefix/suffix match
# - Check file permissions
# - Output verification report
# ==============================================================================

set -euo pipefail

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source shared utilities
# shellcheck source=utils.sh
source "${SCRIPT_DIR}/utils.sh"

# ==============================================================================
# Script Configuration
# ==============================================================================

VERSION="1.0.0"
SCRIPT_NAME="$(basename "$0")"

# ==============================================================================
# Help and Usage
# ==============================================================================

show_help() {
    cat << EOF
${BOLD}Solana Keypair Verification Tool${NC}
Version: ${VERSION}

${BOLD}USAGE:${NC}
    $SCRIPT_NAME [OPTIONS] <keypair-file>

${BOLD}ARGUMENTS:${NC}
    <keypair-file>        Path to the keypair JSON file to verify

${BOLD}OPTIONS:${NC}
    -p, --prefix <str>    Expected prefix to verify
    -s, --suffix <str>    Expected suffix to verify
    -i, --ignore-case     Case-insensitive matching
    -j, --json            Output report as JSON
    -v, --verbose         Verbose output
    -q, --quiet           Quiet mode (exit code only)
    -h, --help            Show this help message
    --version             Show version

${BOLD}EXAMPLES:${NC}
    # Basic verification
    $SCRIPT_NAME ./SOLabc123.json

    # Verify specific prefix
    $SCRIPT_NAME -p Sol ./SOLabc123.json

    # Verify prefix and suffix (case-insensitive)
    $SCRIPT_NAME -p my -s app -i ./keypair.json

    # JSON output for scripting
    $SCRIPT_NAME -j ./keypair.json

${BOLD}VERIFICATION CHECKS:${NC}
    1. File exists and is readable
    2. File has secure permissions (600 or 400)
    3. File contains valid JSON format
    4. JSON is a valid keypair (64-byte array)
    5. Public key can be derived
    6. Prefix matches (if specified)
    7. Suffix matches (if specified)

${BOLD}EXIT CODES:${NC}
    0 - All verification checks passed
    1 - Verification failed (user error)
    2 - System error

EOF
}

show_version() {
    echo "$SCRIPT_NAME version $VERSION"
}

# ==============================================================================
# Argument Parsing
# ==============================================================================

KEYPAIR_FILE=""
EXPECTED_PREFIX=""
EXPECTED_SUFFIX=""
IGNORE_CASE=0
JSON_OUTPUT=0

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -p|--prefix)
                if [[ -z "${2:-}" ]]; then
                    log_error "Option $1 requires an argument"
                    exit "$EXIT_USER_ERROR"
                fi
                EXPECTED_PREFIX="$2"
                shift 2
                ;;
            -s|--suffix)
                if [[ -z "${2:-}" ]]; then
                    log_error "Option $1 requires an argument"
                    exit "$EXIT_USER_ERROR"
                fi
                EXPECTED_SUFFIX="$2"
                shift 2
                ;;
            -i|--ignore-case)
                IGNORE_CASE=1
                shift
                ;;
            -j|--json)
                JSON_OUTPUT=1
                QUIET=1
                shift
                ;;
            -v|--verbose)
                VERBOSE=1
                shift
                ;;
            -q|--quiet)
                QUIET=1
                shift
                ;;
            -h|--help)
                show_help
                exit "$EXIT_SUCCESS"
                ;;
            --version)
                show_version
                exit "$EXIT_SUCCESS"
                ;;
            -*)
                log_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit "$EXIT_USER_ERROR"
                ;;
            *)
                if [[ -z "$KEYPAIR_FILE" ]]; then
                    KEYPAIR_FILE="$1"
                else
                    log_error "Unexpected argument: $1"
                    exit "$EXIT_USER_ERROR"
                fi
                shift
                ;;
        esac
    done
}

# ==============================================================================
# Verification Functions
# ==============================================================================

# Verification result storage
declare -A CHECKS
PUBKEY=""

run_verifications() {
    local all_passed=1
    
    # Check 1: File exists
    if [[ -f "$KEYPAIR_FILE" ]]; then
        CHECKS["file_exists"]="PASS"
        log_debug "File exists: $KEYPAIR_FILE"
    else
        CHECKS["file_exists"]="FAIL"
        CHECKS["file_exists_error"]="File not found: $KEYPAIR_FILE"
        all_passed=0
        return $all_passed
    fi
    
    # Check 2: File is readable
    if [[ -r "$KEYPAIR_FILE" ]]; then
        CHECKS["file_readable"]="PASS"
        log_debug "File is readable"
    else
        CHECKS["file_readable"]="FAIL"
        CHECKS["file_readable_error"]="File is not readable"
        all_passed=0
        return $all_passed
    fi
    
    # Check 3: File permissions
    if check_secure_permissions "$KEYPAIR_FILE"; then
        CHECKS["permissions"]="PASS"
        log_debug "File has secure permissions"
    else
        CHECKS["permissions"]="WARN"
        CHECKS["permissions_error"]="File does not have secure permissions (should be 600 or 400)"
        # This is a warning, not a failure
    fi
    
    # Check 4: Valid JSON format
    if python3 -c "import json; json.load(open('$KEYPAIR_FILE'))" 2>/dev/null; then
        CHECKS["json_valid"]="PASS"
        log_debug "Valid JSON format"
    else
        CHECKS["json_valid"]="FAIL"
        CHECKS["json_valid_error"]="File is not valid JSON"
        all_passed=0
        return $all_passed
    fi
    
    # Check 5: Valid keypair structure (64-byte array)
    if verify_keypair_file "$KEYPAIR_FILE"; then
        CHECKS["keypair_structure"]="PASS"
        log_debug "Valid keypair structure (64-byte array)"
    else
        CHECKS["keypair_structure"]="FAIL"
        CHECKS["keypair_structure_error"]="Invalid keypair structure (must be array of 64 integers 0-255)"
        all_passed=0
        return $all_passed
    fi
    
    # Check 6: Can derive public key
    if PUBKEY=$(solana-keygen pubkey "$KEYPAIR_FILE" 2>/dev/null); then
        CHECKS["pubkey_derivation"]="PASS"
        CHECKS["pubkey"]="$PUBKEY"
        log_debug "Derived public key: $PUBKEY"
    else
        CHECKS["pubkey_derivation"]="FAIL"
        CHECKS["pubkey_derivation_error"]="Failed to derive public key"
        all_passed=0
        return $all_passed
    fi
    
    # Check 7: Prefix match (if specified)
    if [[ -n "$EXPECTED_PREFIX" ]]; then
        local case_flag=$((1 - IGNORE_CASE))
        if check_prefix_match "$PUBKEY" "$EXPECTED_PREFIX" "$case_flag"; then
            CHECKS["prefix_match"]="PASS"
            CHECKS["expected_prefix"]="$EXPECTED_PREFIX"
            log_debug "Prefix matches: $EXPECTED_PREFIX"
        else
            CHECKS["prefix_match"]="FAIL"
            CHECKS["expected_prefix"]="$EXPECTED_PREFIX"
            CHECKS["prefix_match_error"]="Public key does not start with expected prefix"
            all_passed=0
        fi
    fi
    
    # Check 8: Suffix match (if specified)
    if [[ -n "$EXPECTED_SUFFIX" ]]; then
        local case_flag=$((1 - IGNORE_CASE))
        if check_suffix_match "$PUBKEY" "$EXPECTED_SUFFIX" "$case_flag"; then
            CHECKS["suffix_match"]="PASS"
            CHECKS["expected_suffix"]="$EXPECTED_SUFFIX"
            log_debug "Suffix matches: $EXPECTED_SUFFIX"
        else
            CHECKS["suffix_match"]="FAIL"
            CHECKS["expected_suffix"]="$EXPECTED_SUFFIX"
            CHECKS["suffix_match_error"]="Public key does not end with expected suffix"
            all_passed=0
        fi
    fi
    
    # Check 9: Verify keypair (cryptographic verification)
    if solana-keygen verify "$PUBKEY" "$KEYPAIR_FILE" 2>/dev/null; then
        CHECKS["crypto_verify"]="PASS"
        log_debug "Cryptographic verification passed"
    else
        CHECKS["crypto_verify"]="FAIL"
        CHECKS["crypto_verify_error"]="Cryptographic verification failed"
        all_passed=0
    fi
    
    return $all_passed
}

# ==============================================================================
# Output Functions
# ==============================================================================

print_report() {
    local passed=$1
    if [[ "$JSON_OUTPUT" -eq 1 ]]; then
        print_json_report "$passed"
    else
        print_text_report "$passed"
    fi
}

print_text_report() {
    local all_passed=$1
    
    print_line "="
    echo -e "${BOLD}Keypair Verification Report${NC}"
    print_line "="
    echo ""
    echo -e "File: ${CYAN}${KEYPAIR_FILE}${NC}"
    if [[ -n "${CHECKS[pubkey]:-}" ]]; then
        echo -e "Public Key: ${CYAN}${CHECKS[pubkey]}${NC}"
    fi
    echo ""
    print_line "-"
    echo -e "${BOLD}Verification Checks:${NC}"
    print_line "-"
    
    # File checks
    print_check_result "File exists" "${CHECKS[file_exists]:-SKIP}" "${CHECKS[file_exists_error]:-}"
    print_check_result "File readable" "${CHECKS[file_readable]:-SKIP}" "${CHECKS[file_readable_error]:-}"
    print_check_result "Secure permissions" "${CHECKS[permissions]:-SKIP}" "${CHECKS[permissions_error]:-}"
    
    # Format checks
    print_check_result "Valid JSON" "${CHECKS[json_valid]:-SKIP}" "${CHECKS[json_valid_error]:-}"
    print_check_result "Keypair structure" "${CHECKS[keypair_structure]:-SKIP}" "${CHECKS[keypair_structure_error]:-}"
    
    # Crypto checks
    print_check_result "Public key derivation" "${CHECKS[pubkey_derivation]:-SKIP}" "${CHECKS[pubkey_derivation_error]:-}"
    print_check_result "Cryptographic verify" "${CHECKS[crypto_verify]:-SKIP}" "${CHECKS[crypto_verify_error]:-}"
    
    # Pattern checks (if requested)
    if [[ -n "$EXPECTED_PREFIX" ]]; then
        print_check_result "Prefix match (${EXPECTED_PREFIX})" "${CHECKS[prefix_match]:-SKIP}" "${CHECKS[prefix_match_error]:-}"
    fi
    if [[ -n "$EXPECTED_SUFFIX" ]]; then
        print_check_result "Suffix match (${EXPECTED_SUFFIX})" "${CHECKS[suffix_match]:-SKIP}" "${CHECKS[suffix_match_error]:-}"
    fi
    
    echo ""
    print_line "="
    
    if [[ $all_passed -eq 1 ]]; then
        echo -e "${GREEN}${BOLD}✓ All verification checks passed${NC}"
    else
        echo -e "${RED}${BOLD}✗ Some verification checks failed${NC}"
    fi
    
    print_line "="
}

print_check_result() {
    local name="$1"
    local result="$2"
    local error="${3:-}"
    
    case "$result" in
        PASS)
            echo -e "  ${GREEN}✓${NC} $name"
            ;;
        FAIL)
            echo -e "  ${RED}✗${NC} $name"
            if [[ -n "$error" ]]; then
                echo -e "    ${RED}└─ $error${NC}"
            fi
            ;;
        WARN)
            echo -e "  ${YELLOW}⚠${NC} $name"
            if [[ -n "$error" ]]; then
                echo -e "    ${YELLOW}└─ $error${NC}"
            fi
            ;;
        SKIP)
            echo -e "  ${CYAN}-${NC} $name (skipped)"
            ;;
    esac
}

print_json_report() {
    local all_passed=$1
    
    # Build JSON output
    cat << EOF
{
  "file": "$KEYPAIR_FILE",
  "pubkey": "${CHECKS[pubkey]:-null}",
  "passed": $([ "$all_passed" -eq 1 ] && echo "true" || echo "false"),
  "checks": {
    "file_exists": "${CHECKS[file_exists]:-SKIP}",
    "file_readable": "${CHECKS[file_readable]:-SKIP}",
    "permissions": "${CHECKS[permissions]:-SKIP}",
    "json_valid": "${CHECKS[json_valid]:-SKIP}",
    "keypair_structure": "${CHECKS[keypair_structure]:-SKIP}",
    "pubkey_derivation": "${CHECKS[pubkey_derivation]:-SKIP}",
    "crypto_verify": "${CHECKS[crypto_verify]:-SKIP}"$(
    [[ -n "$EXPECTED_PREFIX" ]] && echo ",
    \"prefix_match\": \"${CHECKS[prefix_match]:-SKIP}\""
    )$(
    [[ -n "$EXPECTED_SUFFIX" ]] && echo ",
    \"suffix_match\": \"${CHECKS[suffix_match]:-SKIP}\""
    )
  },
  "options": {
    "expected_prefix": $([ -n "$EXPECTED_PREFIX" ] && echo "\"$EXPECTED_PREFIX\"" || echo "null"),
    "expected_suffix": $([ -n "$EXPECTED_SUFFIX" ] && echo "\"$EXPECTED_SUFFIX\"" || echo "null"),
    "ignore_case": $([ "$IGNORE_CASE" -eq 1 ] && echo "true" || echo "false")
  }
}
EOF
}

# ==============================================================================
# Main Entry Point
# ==============================================================================

main() {
    # Setup signal handlers
    setup_signal_handlers
    
    # Parse command line arguments
    parse_args "$@"
    
    # Validate keypair file argument
    if [[ -z "$KEYPAIR_FILE" ]]; then
        log_error "Keypair file is required"
        echo "Use --help for usage information"
        exit "$EXIT_USER_ERROR"
    fi
    
    # Validate expected prefix if provided
    if [[ -n "$EXPECTED_PREFIX" ]] && ! is_valid_base58 "$EXPECTED_PREFIX"; then
        log_error "Expected prefix contains invalid Base58 characters"
        exit "$EXIT_USER_ERROR"
    fi
    
    # Validate expected suffix if provided
    if [[ -n "$EXPECTED_SUFFIX" ]] && ! is_valid_base58 "$EXPECTED_SUFFIX"; then
        log_error "Expected suffix contains invalid Base58 characters"
        exit "$EXIT_USER_ERROR"
    fi
    
    # Check dependencies
    check_solana_keygen
    
    # Run verifications
    local all_passed=1
    if run_verifications; then
        all_passed=1
    else
        all_passed=0
    fi
    
    # Print report
    if [[ "$QUIET" -eq 0 ]] || [[ "$JSON_OUTPUT" -eq 1 ]]; then
        print_report $all_passed
    fi
    
    # Exit with appropriate code
    if [[ $all_passed -eq 1 ]]; then
        exit "$EXIT_SUCCESS"
    else
        exit "$EXIT_USER_ERROR"
    fi
}

# Run main function
main "$@"
