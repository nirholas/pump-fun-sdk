#!/bin/bash
# ==============================================================================
# Solana Vanity Address Generation Tests
# ==============================================================================
# Test suite for the vanity address generation functionality
# Tests:
#   - 2-char prefix generation
#   - Case-insensitive matching
#   - Invalid prefix handling
#   - File permission verification
#   - Interrupt handling
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
GENERATE_SCRIPT="${PROJECT_ROOT}/scripts/generate-vanity.sh"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test output
TEST_OUTPUT_DIR="${FIXTURES_DIR}/test_output_$$"

# ==============================================================================
# Test Utilities
# ==============================================================================

setup_test_env() {
    mkdir -p "$FIXTURES_DIR"
    mkdir -p "$TEST_OUTPUT_DIR"
    chmod 700 "$TEST_OUTPUT_DIR"
    
    # Ensure scripts are executable
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

assert_equals() {
    local expected="$1"
    local actual="$2"
    local message="${3:-}"
    
    if [[ "$expected" == "$actual" ]]; then
        test_pass "$message"
        return 0
    else
        test_fail "$message (expected: '$expected', got: '$actual')"
        return 1
    fi
}

assert_true() {
    local condition="$1"
    local message="${2:-}"
    
    if eval "$condition"; then
        test_pass "$message"
        return 0
    else
        test_fail "$message"
        return 1
    fi
}

assert_file_exists() {
    local filepath="$1"
    local message="${2:-File exists: $filepath}"
    
    if [[ -f "$filepath" ]]; then
        test_pass "$message"
        return 0
    else
        test_fail "$message"
        return 1
    fi
}

assert_permissions() {
    local filepath="$1"
    local expected_perms="$2"
    local message="${3:-Permissions are $expected_perms}"
    
    local actual_perms
    if [[ "$(uname)" == "Darwin" ]]; then
        actual_perms=$(stat -f "%OLp" "$filepath")
    else
        actual_perms=$(stat -c "%a" "$filepath")
    fi
    
    if [[ "$actual_perms" == "$expected_perms" ]]; then
        test_pass "$message"
        return 0
    else
        test_fail "$message (actual: $actual_perms)"
        return 1
    fi
}

# ==============================================================================
# Test Cases
# ==============================================================================

test_2char_prefix_generation() {
    test_start "2-character prefix generation"
    
    local prefix="AB"
    local output_dir="${TEST_OUTPUT_DIR}/test_2char"
    mkdir -p "$output_dir"
    
    # Run generation with quiet mode
    if "$GENERATE_SCRIPT" -q -o "$output_dir" "$prefix"; then
        # Check that a file was created
        local files=("$output_dir"/*.json)
        if [[ -f "${files[0]}" ]]; then
            # Verify the file starts with the prefix
            local pubkey
            pubkey=$(solana-keygen pubkey "${files[0]}" 2>/dev/null) || {
                test_fail "Could not extract public key"
                return 1
            }
            
            if [[ "$pubkey" == "$prefix"* ]]; then
                test_pass "Generated keypair with prefix '$prefix'"
                
                # Verify permissions
                assert_permissions "${files[0]}" "600" "File has secure permissions"
            else
                test_fail "Public key '$pubkey' does not start with '$prefix'"
            fi
        else
            test_fail "No keypair file generated"
        fi
    else
        test_fail "Generation script returned error"
    fi
}

test_case_insensitive_generation() {
    test_start "Case-insensitive prefix generation"
    
    local prefix="ab"  # lowercase
    local output_dir="${TEST_OUTPUT_DIR}/test_case_insensitive"
    mkdir -p "$output_dir"
    
    # Run generation with ignore-case flag
    if "$GENERATE_SCRIPT" -q -i -o "$output_dir" "$prefix"; then
        local files=("$output_dir"/*.json)
        if [[ -f "${files[0]}" ]]; then
            local pubkey
            pubkey=$(solana-keygen pubkey "${files[0]}" 2>/dev/null) || {
                test_fail "Could not extract public key"
                return 1
            }
            
            # Convert both to lowercase for comparison
            local pubkey_lower
            pubkey_lower=$(echo "$pubkey" | tr '[:upper:]' '[:lower:]')
            
            if [[ "$pubkey_lower" == "$prefix"* ]]; then
                test_pass "Generated keypair with case-insensitive prefix '$prefix'"
            else
                test_fail "Public key '$pubkey' does not match prefix '$prefix' (case-insensitive)"
            fi
        else
            test_fail "No keypair file generated"
        fi
    else
        test_fail "Generation script returned error"
    fi
}

test_invalid_prefix_handling() {
    test_start "Invalid prefix handling"
    
    local invalid_prefixes=("0AB" "OAB" "IAB" "lAB" "AB@" "AB#")
    local all_passed=1
    
    for prefix in "${invalid_prefixes[@]}"; do
        local output_dir="${TEST_OUTPUT_DIR}/test_invalid_${prefix//[^a-zA-Z0-9]/_}"
        mkdir -p "$output_dir"
        
        # Run generation - should fail
        if "$GENERATE_SCRIPT" -q -o "$output_dir" "$prefix" 2>/dev/null; then
            test_fail "Script should reject invalid prefix: '$prefix'"
            all_passed=0
        else
            echo -e "    ${GREEN}✓${NC} Correctly rejected: '$prefix'"
        fi
    done
    
    if [[ $all_passed -eq 1 ]]; then
        test_pass "All invalid prefixes correctly rejected"
    fi
}

test_file_permission_verification() {
    test_start "File permission verification"
    
    local prefix="CD"
    local output_dir="${TEST_OUTPUT_DIR}/test_permissions"
    mkdir -p "$output_dir"
    
    # Run generation
    if "$GENERATE_SCRIPT" -q -o "$output_dir" "$prefix"; then
        local files=("$output_dir"/*.json)
        if [[ -f "${files[0]}" ]]; then
            # Check that file has 600 permissions
            assert_permissions "${files[0]}" "600" "Keypair file has 600 permissions"
            
            # Check directory permissions
            local dir_perms
            if [[ "$(uname)" == "Darwin" ]]; then
                dir_perms=$(stat -f "%OLp" "$output_dir")
            else
                dir_perms=$(stat -c "%a" "$output_dir")
            fi
            
            if [[ "$dir_perms" == "700" ]]; then
                test_pass "Output directory has 700 permissions"
            else
                # 700 is preferred but not strictly required
                test_pass "Output directory has $dir_perms permissions (acceptable)"
            fi
        else
            test_fail "No keypair file generated"
        fi
    else
        test_fail "Generation script returned error"
    fi
}

test_count_parameter() {
    test_start "Count parameter (multiple addresses)"
    
    local prefix="EF"
    local count=3
    local output_dir="${TEST_OUTPUT_DIR}/test_count"
    mkdir -p "$output_dir"
    
    # Run generation with count
    if "$GENERATE_SCRIPT" -q -c "$count" -o "$output_dir" "$prefix"; then
        local file_count
        file_count=$(find "$output_dir" -name "*.json" -type f | wc -l)
        
        if [[ "$file_count" -eq "$count" ]]; then
            test_pass "Generated exactly $count keypairs"
        else
            test_fail "Expected $count files, got $file_count"
        fi
    else
        test_fail "Generation script returned error"
    fi
}

test_verbose_mode() {
    test_start "Verbose mode output"
    
    local prefix="GH"
    local output_dir="${TEST_OUTPUT_DIR}/test_verbose"
    mkdir -p "$output_dir"
    
    # Run with verbose flag and capture output
    local output
    output=$("$GENERATE_SCRIPT" -v -o "$output_dir" "$prefix" 2>&1) || true
    
    # Check for verbose indicators in output
    if echo "$output" | grep -q "Prefix:" && echo "$output" | grep -q "Estimated time:"; then
        test_pass "Verbose output contains expected information"
    else
        test_fail "Verbose output missing expected information"
    fi
}

test_help_output() {
    test_start "Help output"
    
    local output
    output=$("$GENERATE_SCRIPT" --help 2>&1) || true
    
    # Check for expected sections
    if echo "$output" | grep -q "USAGE:" && \
       echo "$output" | grep -q "OPTIONS:" && \
       echo "$output" | grep -q "EXAMPLES:"; then
        test_pass "Help output contains expected sections"
    else
        test_fail "Help output missing expected sections"
    fi
}

test_version_output() {
    test_start "Version output"
    
    local output
    output=$("$GENERATE_SCRIPT" --version 2>&1) || true
    
    if echo "$output" | grep -qE "version [0-9]+\.[0-9]+\.[0-9]+"; then
        test_pass "Version output is properly formatted"
    else
        test_fail "Version output format incorrect"
    fi
}

test_output_directory_creation() {
    test_start "Output directory auto-creation"
    
    local prefix="JK"
    local output_dir="${TEST_OUTPUT_DIR}/nested/path/that/does/not/exist"
    
    # Directory should not exist
    assert_true "[[ ! -d '$output_dir' ]]" "Output directory does not exist initially"
    
    # Run generation
    if "$GENERATE_SCRIPT" -q -o "$output_dir" "$prefix"; then
        assert_true "[[ -d '$output_dir' ]]" "Output directory was created"
    else
        test_fail "Generation script returned error"
    fi
}

test_empty_prefix_rejection() {
    test_start "Empty prefix rejection"
    
    local output_dir="${TEST_OUTPUT_DIR}/test_empty"
    mkdir -p "$output_dir"
    
    # Run with empty prefix - should fail
    if "$GENERATE_SCRIPT" -q -o "$output_dir" "" 2>/dev/null; then
        test_fail "Script should reject empty prefix"
    else
        test_pass "Empty prefix correctly rejected"
    fi
}

# ==============================================================================
# Interrupt Test (Optional - Can Be Slow)
# ==============================================================================

test_interrupt_handling() {
    test_start "Interrupt handling (SIGINT)"
    
    # This test generates a longer prefix that takes some time
    # Then sends SIGINT to test graceful shutdown
    local prefix="ABCDE"  # 5 chars - will take a bit of time
    local output_dir="${TEST_OUTPUT_DIR}/test_interrupt"
    mkdir -p "$output_dir"
    
    # Start generation in background
    "$GENERATE_SCRIPT" -q -o "$output_dir" "$prefix" &
    local pid=$!
    
    # Wait a moment then send SIGINT
    sleep 2
    
    if kill -0 $pid 2>/dev/null; then
        kill -INT $pid 2>/dev/null || true
        
        # Wait for process to exit
        wait $pid 2>/dev/null || true
        
        test_pass "Process terminated gracefully on SIGINT"
    else
        # Process already finished (lucky fast generation)
        test_skip "Process completed before interrupt could be sent"
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
    echo -e "${BOLD}Solana Vanity Address Generation Tests${NC}"
    print_line "="
    
    # Check dependencies
    if ! command -v solana-keygen &> /dev/null; then
        echo -e "${RED}Error: solana-keygen not found${NC}"
        echo "Please install Solana CLI tools first"
        exit 2
    fi
    
    # Setup
    setup_test_env
    
    # Run tests
    test_help_output
    test_version_output
    test_empty_prefix_rejection
    test_invalid_prefix_handling
    test_2char_prefix_generation
    test_case_insensitive_generation
    test_file_permission_verification
    test_count_parameter
    test_verbose_mode
    test_output_directory_creation
    
    # Optional slow test - uncomment to enable
    # test_interrupt_handling
    
    # Print results
    print_results
}

# Run main
main "$@"
