#!/bin/bash
# ==============================================================================
# Solana Vanity Address Toolkit - Shared Utility Functions
# ==============================================================================
# This file contains shared functions used across all scripts in the toolkit.
# Source this file at the beginning of other scripts:
#   source "$(dirname "$0")/utils.sh"
# ==============================================================================

set -euo pipefail

# ==============================================================================
# Configuration
# ==============================================================================

# Valid Base58 characters (excludes 0, O, I, l)
readonly BASE58_CHARS="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

# Exit codes
readonly EXIT_SUCCESS=0
readonly EXIT_USER_ERROR=1
readonly EXIT_SYSTEM_ERROR=2

# Colors for output (disabled if not a terminal)
if [[ -t 1 ]]; then
    readonly RED='\033[0;31m'
    readonly GREEN='\033[0;32m'
    readonly YELLOW='\033[0;33m'
    readonly BLUE='\033[0;34m'
    readonly CYAN='\033[0;36m'
    readonly BOLD='\033[1m'
    readonly NC='\033[0m' # No Color
else
    readonly RED=''
    readonly GREEN=''
    readonly YELLOW=''
    readonly BLUE=''
    readonly CYAN=''
    readonly BOLD=''
    readonly NC=''
fi

# Global flags
VERBOSE=${VERBOSE:-0}
QUIET=${QUIET:-0}

# ==============================================================================
# Logging Functions
# ==============================================================================

# Print an error message to stderr
# Arguments: message
log_error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

# Print a warning message to stderr
# Arguments: message
log_warn() {
    if [[ "$QUIET" -eq 0 ]]; then
        echo -e "${YELLOW}[WARN]${NC} $*" >&2
    fi
}

# Print an info message
# Arguments: message
log_info() {
    if [[ "$QUIET" -eq 0 ]]; then
        echo -e "${BLUE}[INFO]${NC} $*"
    fi
}

# Print a success message
# Arguments: message
log_success() {
    if [[ "$QUIET" -eq 0 ]]; then
        echo -e "${GREEN}[OK]${NC} $*"
    fi
}

# Print a debug message (only in verbose mode)
# Arguments: message
log_debug() {
    if [[ "$VERBOSE" -eq 1 ]]; then
        echo -e "${CYAN}[DEBUG]${NC} $*" >&2
    fi
}

# Print a step indicator
# Arguments: step_number, total_steps, message
log_step() {
    local step="$1"
    local total="$2"
    local message="$3"
    if [[ "$QUIET" -eq 0 ]]; then
        echo -e "${BOLD}[${step}/${total}]${NC} ${message}"
    fi
}

# ==============================================================================
# Validation Functions
# ==============================================================================

# Check if a string contains only valid Base58 characters
# Arguments: string_to_check
# Returns: 0 if valid, 1 if invalid
is_valid_base58() {
    local input="$1"
    local i char
    
    if [[ -z "$input" ]]; then
        return 1
    fi
    
    for (( i=0; i<${#input}; i++ )); do
        char="${input:$i:1}"
        if [[ "$BASE58_CHARS" != *"$char"* ]]; then
            return 1
        fi
    done
    
    return 0
}

# Get invalid characters in a string
# Arguments: string_to_check
# Returns: string of invalid characters (empty if all valid)
get_invalid_chars() {
    local input="$1"
    local invalid=""
    local i char
    
    for (( i=0; i<${#input}; i++ )); do
        char="${input:$i:1}"
        if [[ "$BASE58_CHARS" != *"$char"* ]]; then
            if [[ "$invalid" != *"$char"* ]]; then
                invalid="${invalid}${char}"
            fi
        fi
    done
    
    echo "$invalid"
}

# Validate prefix and exit with helpful error if invalid
# Arguments: prefix
validate_prefix() {
    local prefix="$1"
    
    if [[ -z "$prefix" ]]; then
        log_error "Prefix cannot be empty"
        return "$EXIT_USER_ERROR"
    fi
    
    if [[ ${#prefix} -gt 8 ]]; then
        log_warn "Prefix length ${#prefix} chars - this may take extremely long to generate"
    fi
    
    if ! is_valid_base58 "$prefix"; then
        local invalid_chars
        invalid_chars=$(get_invalid_chars "$prefix")
        log_error "Prefix contains invalid Base58 character(s): '$invalid_chars'"
        log_error "Valid characters: $BASE58_CHARS"
        log_error "Note: 0 (zero), O (capital o), I (capital i), l (lowercase L) are not allowed"
        return "$EXIT_USER_ERROR"
    fi
    
    return 0
}

# ==============================================================================
# File Operations
# ==============================================================================

# Set secure permissions on a file (owner read/write only)
# Arguments: filepath
set_secure_permissions() {
    local filepath="$1"
    
    if [[ ! -f "$filepath" ]]; then
        log_error "File not found: $filepath"
        return "$EXIT_USER_ERROR"
    fi
    
    chmod 600 "$filepath"
    log_debug "Set permissions 600 on $filepath"
}

# Check if a file has secure permissions (600 or 400)
# Arguments: filepath
# Returns: 0 if secure, 1 if not
check_secure_permissions() {
    local filepath="$1"
    local perms
    
    if [[ ! -f "$filepath" ]]; then
        return 1
    fi
    
    # Get numeric permissions
    if [[ "$(uname)" == "Darwin" ]]; then
        perms=$(stat -f "%OLp" "$filepath")
    else
        perms=$(stat -c "%a" "$filepath")
    fi
    
    if [[ "$perms" == "600" || "$perms" == "400" ]]; then
        return 0
    else
        return 1
    fi
}

# Securely delete a file
# Arguments: filepath
secure_delete() {
    local filepath="$1"
    
    if [[ ! -f "$filepath" ]]; then
        log_debug "File already deleted or not found: $filepath"
        return 0
    fi
    
    # Try shred first (Linux), then gshred (macOS with coreutils), then fallback
    if command -v shred &> /dev/null; then
        shred -vfz -n 3 "$filepath" 2>/dev/null && rm -f "$filepath"
    elif command -v gshred &> /dev/null; then
        gshred -vfz -n 3 "$filepath" 2>/dev/null && rm -f "$filepath"
    else
        # Fallback: overwrite with random data then delete
        local size
        size=$(wc -c < "$filepath")
        dd if=/dev/urandom of="$filepath" bs=1 count="$size" 2>/dev/null
        sync
        rm -f "$filepath"
    fi
    
    log_debug "Securely deleted: $filepath"
}

# Create a timestamped backup directory
# Arguments: base_path (optional, defaults to current directory)
# Returns: path to created directory (echoed to stdout)
create_backup_dir() {
    local base_path="${1:-.}"
    local timestamp
    timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_dir="${base_path}/backup_${timestamp}"
    
    mkdir -p "$backup_dir"
    chmod 700 "$backup_dir"
    
    echo "$backup_dir"
}

# ==============================================================================
# System Checks
# ==============================================================================

# Check if solana-keygen is installed and accessible
# Returns: 0 if available, exits with error if not
check_solana_keygen() {
    if ! command -v solana-keygen &> /dev/null; then
        log_error "solana-keygen not found in PATH"
        log_error "Please install Solana CLI tools:"
        log_error "  sh -c \"\$(curl -sSfL https://release.solana.com/stable/install)\""
        log_error "Then add to PATH:"
        log_error "  export PATH=\"\$HOME/.local/share/solana/install/active_release/bin:\$PATH\""
        exit "$EXIT_SYSTEM_ERROR"
    fi
    
    log_debug "solana-keygen found: $(which solana-keygen)"
}

# Get the number of CPU cores
# Returns: number of cores (echoed to stdout)
get_cpu_cores() {
    local cores
    
    if command -v nproc &> /dev/null; then
        cores=$(nproc)
    elif [[ "$(uname)" == "Darwin" ]]; then
        cores=$(sysctl -n hw.ncpu)
    else
        cores=$(grep -c processor /proc/cpuinfo 2>/dev/null || echo "1")
    fi
    
    echo "$cores"
}

# ==============================================================================
# Time Estimation
# ==============================================================================

# Estimate time for vanity address generation
# Arguments: prefix_length, case_sensitive (1=yes, 0=no), num_cores
# Returns: estimated time string (echoed to stdout)
estimate_time() {
    local prefix_length="$1"
    local case_sensitive="${2:-1}"
    local num_cores="${3:-$(get_cpu_cores)}"
    
    # Base calculations (approximate combinations)
    local base=58
    local combinations=1
    local i
    
    for (( i=0; i<prefix_length; i++ )); do
        combinations=$((combinations * base))
    done
    
    # If case insensitive, divide by ~2^(number of letters)
    if [[ "$case_sensitive" -eq 0 ]]; then
        # Rough estimate: assume 80% of chars are letters
        local letter_count=$((prefix_length * 80 / 100))
        local case_divisor=$((1 << letter_count))  # 2^letter_count
        combinations=$((combinations / case_divisor))
    fi
    
    # Assume ~100,000 attempts per second per core (conservative)
    local attempts_per_second=$((100000 * num_cores))
    local seconds=$((combinations / attempts_per_second / 2))  # Divide by 2 for average
    
    # Format the time
    if [[ $seconds -lt 1 ]]; then
        echo "< 1 second"
    elif [[ $seconds -lt 60 ]]; then
        echo "~$seconds seconds"
    elif [[ $seconds -lt 3600 ]]; then
        echo "~$((seconds / 60)) minutes"
    elif [[ $seconds -lt 86400 ]]; then
        echo "~$((seconds / 3600)) hours"
    elif [[ $seconds -lt 604800 ]]; then
        echo "~$((seconds / 86400)) days"
    elif [[ $seconds -lt 31536000 ]]; then
        echo "~$((seconds / 604800)) weeks"
    else
        echo "~$((seconds / 31536000)) years"
    fi
}

# ==============================================================================
# Keypair Operations
# ==============================================================================

# Get public key from a keypair file
# Arguments: keypair_file_path
# Returns: public key string (echoed to stdout)
get_pubkey_from_file() {
    local keypair_file="$1"
    
    if [[ ! -f "$keypair_file" ]]; then
        log_error "Keypair file not found: $keypair_file"
        return "$EXIT_USER_ERROR"
    fi
    
    solana-keygen pubkey "$keypair_file"
}

# Verify a keypair file is valid
# Arguments: keypair_file_path
# Returns: 0 if valid, 1 if invalid
verify_keypair_file() {
    local keypair_file="$1"
    
    if [[ ! -f "$keypair_file" ]]; then
        return 1
    fi
    
    # Check it's valid JSON with expected format (array of 64 integers)
    if ! python3 -c "
import json, sys
try:
    with open('$keypair_file', 'r') as f:
        data = json.load(f)
    if not isinstance(data, list) or len(data) != 64:
        sys.exit(1)
    for item in data:
        if not isinstance(item, int) or item < 0 or item > 255:
            sys.exit(1)
except:
    sys.exit(1)
" 2>/dev/null; then
        return 1
    fi
    
    # Verify we can extract a public key
    if ! solana-keygen pubkey "$keypair_file" &>/dev/null; then
        return 1
    fi
    
    return 0
}

# Check if public key matches expected prefix
# Arguments: public_key, expected_prefix, case_sensitive (1=yes, 0=no)
# Returns: 0 if matches, 1 if not
check_prefix_match() {
    local pubkey="$1"
    local prefix="$2"
    local case_sensitive="${3:-1}"
    
    if [[ "$case_sensitive" -eq 0 ]]; then
        pubkey=$(echo "$pubkey" | tr '[:upper:]' '[:lower:]')
        prefix=$(echo "$prefix" | tr '[:upper:]' '[:lower:]')
    fi
    
    if [[ "$pubkey" == "$prefix"* ]]; then
        return 0
    else
        return 1
    fi
}

# Check if public key matches expected suffix
# Arguments: public_key, expected_suffix, case_sensitive (1=yes, 0=no)
# Returns: 0 if matches, 1 if not
check_suffix_match() {
    local pubkey="$1"
    local suffix="$2"
    local case_sensitive="${3:-1}"
    
    if [[ "$case_sensitive" -eq 0 ]]; then
        pubkey=$(echo "$pubkey" | tr '[:upper:]' '[:lower:]')
        suffix=$(echo "$suffix" | tr '[:upper:]' '[:lower:]')
    fi
    
    if [[ "$pubkey" == *"$suffix" ]]; then
        return 0
    else
        return 1
    fi
}

# ==============================================================================
# GPG Encryption
# ==============================================================================

# Encrypt a file with GPG
# Arguments: filepath, output_filepath (optional, defaults to filepath.gpg)
# Returns: 0 on success, 1 on failure
encrypt_with_gpg() {
    local filepath="$1"
    local output="${2:-${filepath}.gpg}"
    
    if ! command -v gpg &> /dev/null; then
        log_error "GPG not found. Please install GPG to enable encryption."
        return "$EXIT_SYSTEM_ERROR"
    fi
    
    if [[ ! -f "$filepath" ]]; then
        log_error "File not found: $filepath"
        return "$EXIT_USER_ERROR"
    fi
    
    if ! gpg --symmetric --cipher-algo AES256 --output "$output" "$filepath"; then
        log_error "GPG encryption failed"
        return "$EXIT_SYSTEM_ERROR"
    fi
    
    chmod 600 "$output"
    log_success "Encrypted to: $output"
    return 0
}

# Decrypt a GPG file
# Arguments: encrypted_filepath, output_filepath
# Returns: 0 on success, 1 on failure
decrypt_with_gpg() {
    local encrypted_file="$1"
    local output="$2"
    
    if ! command -v gpg &> /dev/null; then
        log_error "GPG not found. Please install GPG to enable decryption."
        return "$EXIT_SYSTEM_ERROR"
    fi
    
    if [[ ! -f "$encrypted_file" ]]; then
        log_error "Encrypted file not found: $encrypted_file"
        return "$EXIT_USER_ERROR"
    fi
    
    if ! gpg --decrypt --output "$output" "$encrypted_file"; then
        log_error "GPG decryption failed"
        return "$EXIT_SYSTEM_ERROR"
    fi
    
    chmod 600 "$output"
    log_success "Decrypted to: $output"
    return 0
}

# ==============================================================================
# Signal Handling
# ==============================================================================

# Cleanup function to be called on script exit
# Override this in scripts that source utils.sh
cleanup() {
    log_debug "Cleanup called"
}

# Setup signal handlers
setup_signal_handlers() {
    trap 'log_warn "Interrupted by user"; cleanup; exit 130' INT
    trap 'log_warn "Terminated"; cleanup; exit 143' TERM
    trap 'cleanup' EXIT
}

# ==============================================================================
# Utility Helpers
# ==============================================================================

# Print a horizontal line
print_line() {
    local char="${1:--}"
    local width="${2:-60}"
    printf '%*s\n' "$width" '' | tr ' ' "$char"
}

# Confirm action with user
# Arguments: prompt
# Returns: 0 if yes, 1 if no
confirm() {
    local prompt="${1:-Continue?}"
    local response
    
    if [[ "$QUIET" -eq 1 ]]; then
        return 0  # Auto-confirm in quiet mode
    fi
    
    read -r -p "$prompt [y/N] " response
    case "$response" in
        [yY][eE][sS]|[yY]) return 0 ;;
        *) return 1 ;;
    esac
}

# Display usage and exit
# Arguments: script_name, usage_text
usage() {
    local script_name="$1"
    local usage_text="$2"
    
    echo "Usage: $script_name $usage_text"
    exit "$EXIT_USER_ERROR"
}
