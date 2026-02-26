#!/bin/bash
# ==============================================================================
# Solana Keypair Verification Tests
# ==============================================================================
# Test suite for the keypair verification functionality
# Tests:
#   - Valid keypair verification
#   - Corrupted file detection
#   - Wrong prefix detection
#   - Permission checks
#   - JSON output
# ==============================================================================

set -euo pipefail

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Source utilities for shared functions
# shellcheck source=../../scripts/utils.sh
source "${PROJECT_ROOT}/scripts/utils.sh"

# ==============================================================================
# Test Configuration
# ==============================================================================

FIXTURES_DIR="${SCRIPT_DIR}/fixtures"
VERIFY_SCRIPT="${PROJECT_ROOT}/scripts/verify-keypair.sh"
GENERATE_SCRIPT="${PROJECT_ROOT}/scripts/generate-vanity.sh"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test output
TEST_OUTPUT_DIR="${FIXTURES_DIR}/verify_test_$$"

# ==============================================================================
# Test Utilities
# ==============================================================================

setup_test_env() {
    mkdir -p "$FIXTURES_DIR"
    mkdir -p "$TEST_OUTPUT_DIR"
    chmod 700 "$TEST_OUTPUT_DIR"
    
    # Ensure scripts are executable
    chmod +x "$VERIFY_SCRIPT"
    chmod +x "$GENERATE_SCRIPT"
}

cleanup_test_env() {
    if [[ -d "$TEST_OUTPUT_DIR" ]]; then
        # Securely delete any generated keypairs
        find "$TEST_OUTPUT_DIR" -name "*.json" -type f -exec sh -c '
            if command -v shred &> /dev/null; then
                shred -fz -n 3 "$1" 2>/dev/null
            fi
            rm -f "$1"
        ' _ {} \; 2>/dev/null || true
        
        rm -rf "$TEST_OUTPUT_DIR"
    fi
}

# Trap to ensure cleanup on exit
trap cleanup_test_env EXIT

# Test result logging
test_start() {
    local test_name="$1"
    TESTS_RUN=$((TESTS_RUN + 1))
    echo -e "\n${BOLD}[TEST ${TESTS_RUN}]${NC} ${test_name}"
}

test_pass() {
    local message="${1:-}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "  ${GREEN}✓ PASS${NC} ${message}"
}

test_fail() {
    local message="${1:-}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "  ${RED}✗ FAIL${NC} ${message}"
}

test_skip() {
    local message="${1:-}"
    echo -e "  ${YELLOW}⊘ SKIP${NC} ${message}"
}

# Helper to generate a test keypair
generate_test_keypair() {
    local prefix="${1:-AB}"
    local output_dir="${2:-$TEST_OUTPUT_DIR}"
    
    "$GENERATE_SCRIPT" -q -o "$output_dir" "$prefix" 2>/dev/null
    
    # Return the path to the generated file
    local files=("$output_dir"/*.json)
    if [[ -f "${files[0]}" ]]; then
        echo "${files[0]}"
    else
        return 1
    fi
}

# ==============================================================================
# Test Cases
# ==============================================================================

test_valid_keypair_verification() {
    test_start "Valid keypair verification"
    
    local output_dir="${TEST_OUTPUT_DIR}/valid"
    mkdir -p "$output_dir"
    
    # Generate a valid keypair
    local keypair_file
    keypair_file=$(generate_test_keypair "MN" "$output_dir") || {
        test_fail "Could not generate test keypair"
        return 1
    }
    
    # Verify it
    if "$VERIFY_SCRIPT" -q "$keypair_file"; then
        test_pass "Valid keypair passed verification"
    else
        test_fail "Valid keypair failed verification"
    fi
}

test_valid_keypair_with_prefix() {
    test_start "Valid keypair with prefix verification"
    
    local prefix="PQ"
    local output_dir="${TEST_OUTPUT_DIR}/prefix"
    mkdir -p "$output_dir"
    
    # Generate a keypair with known prefix
    local keypair_file
    keypair_file=$(generate_test_keypair "$prefix" "$output_dir") || {
        test_fail "Could not generate test keypair"
        return 1
    }
    
    # Verify with correct prefix
    if "$VERIFY_SCRIPT" -q -p "$prefix" "$keypair_file"; then
        test_pass "Keypair verified with correct prefix"
    else
        test_fail "Keypair failed verification with correct prefix"
    fi
}

test_wrong_prefix_detection() {
    test_start "Wrong prefix detection"
    
    local actual_prefix="RS"
    local wrong_prefix="WX"
    local output_dir="${TEST_OUTPUT_DIR}/wrong_prefix"
    mkdir -p "$output_dir"
    
    # Generate a keypair
    local keypair_file
    keypair_file=$(generate_test_keypair "$actual_prefix" "$output_dir") || {
        test_fail "Could not generate test keypair"
        return 1
    }
    
    # Verify with wrong prefix - should fail
    if "$VERIFY_SCRIPT" -q -p "$wrong_prefix" "$keypair_file" 2>/dev/null; then
        test_fail "Wrong prefix was not detected"
    else
        test_pass "Wrong prefix correctly detected"
    fi
}

test_case_insensitive_prefix() {
    test_start "Case-insensitive prefix verification"
    
    local prefix="tu"  # lowercase
    local output_dir="${TEST_OUTPUT_DIR}/case_prefix"
    mkdir -p "$output_dir"
    
    # Generate a keypair with case-insensitive prefix
    "$GENERATE_SCRIPT" -q -i -o "$output_dir" "$prefix" 2>/dev/null || {
        test_fail "Could not generate test keypair"
        return 1
    }
    
    local files=("$output_dir"/*.json)
    local keypair_file="${files[0]}"
    
    if [[ ! -f "$keypair_file" ]]; then
        test_fail "No keypair file generated"
        return 1
    fi
    
    # Verify with case-insensitive flag
    if "$VERIFY_SCRIPT" -q -i -p "$prefix" "$keypair_file"; then
        test_pass "Case-insensitive prefix verification passed"
    else
        # Try uppercase
        if "$VERIFY_SCRIPT" -q -i -p "TU" "$keypair_file"; then
            test_pass "Case-insensitive prefix verification passed (uppercase)"
        else
            test_fail "Case-insensitive prefix verification failed"
        fi
    fi
}

test_corrupted_file_detection() {
    test_start "Corrupted file detection"
    
    local output_dir="${TEST_OUTPUT_DIR}/corrupted"
    mkdir -p "$output_dir"
    
    # Create various corrupted files
    local corrupted_files=()
    
    # Empty file
    local empty_file="${output_dir}/empty.json"
    touch "$empty_file"
    corrupted_files+=("$empty_file")
    
    # Invalid JSON
    local invalid_json="${output_dir}/invalid.json"
    echo "not json at all" > "$invalid_json"
    corrupted_files+=("$invalid_json")
    
    # JSON but wrong format (object instead of array)
    local wrong_format="${output_dir}/wrong_format.json"
    echo '{"key": "value"}' > "$wrong_format"
    corrupted_files+=("$wrong_format")
    
    # Array but wrong length
    local wrong_length="${output_dir}/wrong_length.json"
    echo '[1,2,3,4,5]' > "$wrong_length"
    corrupted_files+=("$wrong_length")
    
    # Array with invalid values
    local invalid_values="${output_dir}/invalid_values.json"
    python3 -c "import json; print(json.dumps([256] + [0]*63))" > "$invalid_values"
    corrupted_files+=("$invalid_values")
    
    # Test each corrupted file
    local all_detected=1
    for corrupted_file in "${corrupted_files[@]}"; do
        chmod 600 "$corrupted_file"
        local basename
        basename=$(basename "$corrupted_file")
        
        if "$VERIFY_SCRIPT" -q "$corrupted_file" 2>/dev/null; then
            echo -e "    ${RED}✗${NC} Not detected: $basename"
            all_detected=0
        else
            echo -e "    ${GREEN}✓${NC} Detected: $basename"
        fi
    done
    
    if [[ $all_detected -eq 1 ]]; then
        test_pass "All corrupted files detected"
    else
        test_fail "Some corrupted files not detected"
    fi
}

test_nonexistent_file() {
    test_start "Non-existent file handling"
    
    local fake_file="${TEST_OUTPUT_DIR}/does_not_exist.json"
    
    # Verify non-existent file - should fail
    if "$VERIFY_SCRIPT" -q "$fake_file" 2>/dev/null; then
        test_fail "Non-existent file was not detected"
    else
        test_pass "Non-existent file correctly detected"
    fi
}

test_permission_warning() {
    test_start "Permission warning for insecure files"
    
    local output_dir="${TEST_OUTPUT_DIR}/perms"
    mkdir -p "$output_dir"
    
    # Generate a valid keypair
    local keypair_file
    keypair_file=$(generate_test_keypair "YZ" "$output_dir") || {
        test_fail "Could not generate test keypair"
        return 1
    }
    
    # Make it world-readable (insecure)
    chmod 644 "$keypair_file"
    
    # Verify - should pass but with warning
    local output
    output=$("$VERIFY_SCRIPT" "$keypair_file" 2>&1) || true
    
    if echo "$output" | grep -qi "permission\|warn"; then
        test_pass "Permission warning was shown"
    else
        test_fail "No permission warning shown"
    fi
    
    # Restore secure permissions
    chmod 600 "$keypair_file"
}

test_json_output() {
    test_start "JSON output format"
    
    local output_dir="${TEST_OUTPUT_DIR}/json"
    mkdir -p "$output_dir"
    
    # Generate a valid keypair
    local keypair_file
    keypair_file=$(generate_test_keypair "12" "$output_dir") || {
        test_fail "Could not generate test keypair"
        return 1
    }
    
    # Get JSON output
    local json_output
    json_output=$("$VERIFY_SCRIPT" -j "$keypair_file" 2>/dev/null) || {
        test_fail "JSON output failed"
        return 1
    }
    
    # Validate JSON format
    if python3 -c "import json; json.loads('''$json_output''')" 2>/dev/null; then
        test_pass "JSON output is valid"
        
        # Check for expected fields
        if echo "$json_output" | python3 -c "
import json, sys
data = json.load(sys.stdin)
assert 'file' in data
assert 'pubkey' in data
assert 'passed' in data
assert 'checks' in data
" 2>/dev/null; then
            test_pass "JSON output contains expected fields"
        else
            test_fail "JSON output missing expected fields"
        fi
    else
        test_fail "JSON output is not valid JSON"
    fi
}

test_suffix_verification() {
    test_start "Suffix verification"
    
    local output_dir="${TEST_OUTPUT_DIR}/suffix"
    mkdir -p "$output_dir"
    
    # Generate a keypair
    local keypair_file
    keypair_file=$(generate_test_keypair "34" "$output_dir") || {
        test_fail "Could not generate test keypair"
        return 1
    }
    
    # Get the public key and its last 2 characters
    local pubkey
    pubkey=$(solana-keygen pubkey "$keypair_file" 2>/dev/null) || {
        test_fail "Could not get public key"
        return 1
    }
    
    local suffix="${pubkey: -2}"
    
    # Verify with correct suffix
    if "$VERIFY_SCRIPT" -q -s "$suffix" "$keypair_file"; then
        test_pass "Correct suffix verified"
    else
        test_fail "Correct suffix verification failed"
    fi
    
    # Verify with wrong suffix
    local wrong_suffix="ZZ"
    if "$VERIFY_SCRIPT" -q -s "$wrong_suffix" "$keypair_file" 2>/dev/null; then
        test_fail "Wrong suffix was not detected"
    else
        test_pass "Wrong suffix correctly detected"
    fi
}

test_help_output() {
    test_start "Help output"
    
    local output
    output=$("$VERIFY_SCRIPT" --help 2>&1) || true
    
    # Check for expected sections
    if echo "$output" | grep -q "USAGE:" && \
       echo "$output" | grep -q "OPTIONS:" && \
       echo "$output" | grep -q "VERIFICATION CHECKS:"; then
        test_pass "Help output contains expected sections"
    else
        test_fail "Help output missing expected sections"
    fi
}

test_version_output() {
    test_start "Version output"
    
    local output
    output=$("$VERIFY_SCRIPT" --version 2>&1) || true
    
    if echo "$output" | grep -qE "version [0-9]+\.[0-9]+\.[0-9]+"; then
        test_pass "Version output is properly formatted"
    else
        test_fail "Version output format incorrect"
    fi
}

test_no_argument() {
    test_start "No argument handling"
    
    # Run without file argument - should fail
    if "$VERIFY_SCRIPT" 2>/dev/null; then
        test_fail "Script should fail without file argument"
    else
        test_pass "Correctly fails without file argument"
    fi
}

test_verbose_mode() {
    test_start "Verbose mode output"
    
    local output_dir="${TEST_OUTPUT_DIR}/verbose"
    mkdir -p "$output_dir"
    
    # Generate a valid keypair
    local keypair_file
    keypair_file=$(generate_test_keypair "56" "$output_dir") || {
        test_fail "Could not generate test keypair"
        return 1
    }
    
    # Run with verbose flag
    local output
    output=$("$VERIFY_SCRIPT" -v "$keypair_file" 2>&1) || true
    
    # Check for verification report
    if echo "$output" | grep -q "Verification" && echo "$output" | grep -q "Public Key"; then
        test_pass "Verbose output shows verification report"
    else
        test_fail "Verbose output missing verification report"
    fi
}

test_crypto_verification() {
    test_start "Cryptographic verification"
    
    local output_dir="${TEST_OUTPUT_DIR}/crypto"
    mkdir -p "$output_dir"
    
    # Generate a valid keypair
    local keypair_file
    keypair_file=$(generate_test_keypair "78" "$output_dir") || {
        test_fail "Could not generate test keypair"
        return 1
    }
    
    # Get pubkey
    local pubkey
    pubkey=$(solana-keygen pubkey "$keypair_file" 2>/dev/null) || {
        test_fail "Could not get public key"
        return 1
    }
    
    # Verify using solana-keygen directly
    if solana-keygen verify "$pubkey" "$keypair_file" 2>/dev/null; then
        test_pass "Cryptographic verification passed"
    else
        test_fail "Cryptographic verification failed"
    fi
}

# ==============================================================================
# Main Test Runner
# ==============================================================================

print_results() {
    echo ""
    print_line "="
    echo -e "${BOLD}Test Results${NC}"
    print_line "="
    echo ""
    echo -e "Tests run:    ${TESTS_RUN}"
    echo -e "Tests passed: ${GREEN}${TESTS_PASSED}${NC}"
    echo -e "Tests failed: ${RED}${TESTS_FAILED}${NC}"
    echo ""
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}${BOLD}All tests passed!${NC}"
        print_line "="
        return 0
    else
        echo -e "${RED}${BOLD}Some tests failed!${NC}"
        print_line "="
        return 1
    fi
}

main() {
    echo ""
    print_line "="
    echo -e "${BOLD}Solana Keypair Verification Tests${NC}"
    print_line "="
    
    # Check dependencies
    if ! command -v solana-keygen &> /dev/null; then
        echo -e "${RED}Error: solana-keygen not found${NC}"
        echo "Please install Solana CLI tools first"
        exit 2
    fi
    
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}Error: python3 not found${NC}"
        echo "Python 3 is required for JSON validation"
        exit 2
    fi
    
    # Setup
    setup_test_env
    
    # Run tests
    test_help_output
    test_version_output
    test_no_argument
    test_nonexistent_file
    test_valid_keypair_verification
    test_valid_keypair_with_prefix
    test_wrong_prefix_detection
    test_case_insensitive_prefix
    test_suffix_verification
    test_corrupted_file_detection
    test_permission_warning
    test_json_output
    test_verbose_mode
    test_crypto_verification
    
    # Print results
    print_results
}

# Run main
main "$@"
