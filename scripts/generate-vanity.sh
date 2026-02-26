#!/bin/bash
# ==============================================================================
# Solana Vanity Address Generator
# ==============================================================================
# Production-ready wrapper for solana-keygen grind with:
# - Input validation
# - Secure file permissions
# - Progress feedback
# - Error handling
# - Automatic backup
# - Optional GPG encryption
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

# Default values
DEFAULT_COUNT=1
DEFAULT_OUTPUT_DIR="."
DEFAULT_THREADS=""  # Empty means use all cores

# ==============================================================================
# Help and Usage
# ==============================================================================

show_help() {
    cat << EOF
${BOLD}Solana Vanity Address Generator${NC}
Version: ${VERSION}

${BOLD}USAGE:${NC}
    $SCRIPT_NAME [OPTIONS] <prefix>

${BOLD}ARGUMENTS:${NC}
    <prefix>              The prefix to search for (Base58 characters only)

${BOLD}OPTIONS:${NC}
    -s, --suffix <str>    Also match a suffix (combines with prefix)
    -c, --count <n>       Number of addresses to generate (default: $DEFAULT_COUNT)
    -o, --output <dir>    Output directory (default: current directory)
    -t, --threads <n>     Number of threads (default: all cores)
    -i, --ignore-case     Case-insensitive matching
    -e, --encrypt         Encrypt output with GPG
    -b, --backup          Create timestamped backup of output
    -n, --no-outfile      Print to stdout instead of file (INSECURE)
    -v, --verbose         Verbose output
    -q, --quiet           Quiet mode (minimal output)
    -h, --help            Show this help message
    --version             Show version

${BOLD}EXAMPLES:${NC}
    # Generate address starting with "Sol"
    $SCRIPT_NAME Sol

    # Generate 5 addresses starting with "Pay" (case-insensitive)
    $SCRIPT_NAME -c 5 -i Pay

    # Generate with prefix and suffix
    $SCRIPT_NAME -s App My

    # Generate and encrypt with GPG
    $SCRIPT_NAME -e MySecret

    # Generate to specific directory with backup
    $SCRIPT_NAME -o ./keys -b Wallet

${BOLD}SECURITY NOTES:${NC}
    - Output files are automatically set to mode 600 (owner read/write only)
    - Never share your keypair files
    - Use --encrypt for additional security
    - The --no-outfile option displays the secret key - use with caution

${BOLD}BASE58 CHARACTERS:${NC}
    Valid: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
    Invalid: 0 (zero), O (capital o), I (capital i), l (lowercase L)

EOF
}

show_version() {
    echo "$SCRIPT_NAME version $VERSION"
}

# ==============================================================================
# Argument Parsing
# ==============================================================================

PREFIX=""
SUFFIX=""
COUNT="$DEFAULT_COUNT"
OUTPUT_DIR="$DEFAULT_OUTPUT_DIR"
THREADS="$DEFAULT_THREADS"
IGNORE_CASE=0
ENCRYPT=0
BACKUP=0
NO_OUTFILE=0

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -s|--suffix)
                if [[ -z "${2:-}" ]]; then
                    log_error "Option $1 requires an argument"
                    exit "$EXIT_USER_ERROR"
                fi
                SUFFIX="$2"
                shift 2
                ;;
            -c|--count)
                if [[ -z "${2:-}" ]]; then
                    log_error "Option $1 requires an argument"
                    exit "$EXIT_USER_ERROR"
                fi
                if ! [[ "$2" =~ ^[0-9]+$ ]] || [[ "$2" -lt 1 ]]; then
                    log_error "Count must be a positive integer"
                    exit "$EXIT_USER_ERROR"
                fi
                COUNT="$2"
                shift 2
                ;;
            -o|--output)
                if [[ -z "${2:-}" ]]; then
                    log_error "Option $1 requires an argument"
                    exit "$EXIT_USER_ERROR"
                fi
                OUTPUT_DIR="$2"
                shift 2
                ;;
            -t|--threads)
                if [[ -z "${2:-}" ]]; then
                    log_error "Option $1 requires an argument"
                    exit "$EXIT_USER_ERROR"
                fi
                if ! [[ "$2" =~ ^[0-9]+$ ]] || [[ "$2" -lt 1 ]]; then
                    log_error "Threads must be a positive integer"
                    exit "$EXIT_USER_ERROR"
                fi
                THREADS="$2"
                shift 2
                ;;
            -i|--ignore-case)
                IGNORE_CASE=1
                shift
                ;;
            -e|--encrypt)
                ENCRYPT=1
                shift
                ;;
            -b|--backup)
                BACKUP=1
                shift
                ;;
            -n|--no-outfile)
                NO_OUTFILE=1
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
                if [[ -z "$PREFIX" ]]; then
                    PREFIX="$1"
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
# Validation
# ==============================================================================

validate_inputs() {
    # Check prefix is provided
    if [[ -z "$PREFIX" ]]; then
        log_error "Prefix is required"
        echo "Use --help for usage information"
        exit "$EXIT_USER_ERROR"
    fi
    
    # Validate prefix
    if ! validate_prefix "$PREFIX"; then
        exit "$EXIT_USER_ERROR"
    fi
    
    # Validate suffix if provided
    if [[ -n "$SUFFIX" ]]; then
        if ! is_valid_base58 "$SUFFIX"; then
            local invalid_chars
            invalid_chars=$(get_invalid_chars "$SUFFIX")
            log_error "Suffix contains invalid Base58 character(s): '$invalid_chars'"
            exit "$EXIT_USER_ERROR"
        fi
    fi
    
    # Create output directory if needed
    if [[ "$NO_OUTFILE" -eq 0 ]]; then
        if [[ ! -d "$OUTPUT_DIR" ]]; then
            log_info "Creating output directory: $OUTPUT_DIR"
            mkdir -p "$OUTPUT_DIR"
            chmod 700 "$OUTPUT_DIR"
        fi
    fi
    
    # Check GPG availability if encryption requested
    if [[ "$ENCRYPT" -eq 1 ]] && ! command -v gpg &> /dev/null; then
        log_error "GPG not found. Cannot encrypt output."
        log_error "Install GPG or remove the --encrypt option"
        exit "$EXIT_SYSTEM_ERROR"
    fi
    
    # Warn about security implications of --no-outfile
    if [[ "$NO_OUTFILE" -eq 1 ]]; then
        log_warn "Using --no-outfile will display the secret key on screen!"
        if [[ "$QUIET" -eq 0 ]]; then
            if ! confirm "Are you sure you want to continue?"; then
                log_info "Aborted by user"
                exit "$EXIT_SUCCESS"
            fi
        fi
    fi
}

# ==============================================================================
# Main Generation Logic
# ==============================================================================

# Cleanup handler
GENERATED_FILES=()
cleanup() {
    # Called on script exit - can be used to clean up temp files if needed
    log_debug "Cleanup complete"
}

generate_vanity_address() {
    local start_time end_time duration
    
    # Build the command
    local cmd=("solana-keygen" "grind")
    
    # Add match pattern
    if [[ -n "$SUFFIX" ]]; then
        cmd+=("--starts-and-ends-with" "${PREFIX}:${SUFFIX}:${COUNT}")
    else
        cmd+=("--starts-with" "${PREFIX}:${COUNT}")
    fi
    
    # Add optional flags
    if [[ "$IGNORE_CASE" -eq 1 ]]; then
        cmd+=("--ignore-case")
    fi
    
    if [[ -n "$THREADS" ]]; then
        cmd+=("--num-threads" "$THREADS")
    fi
    
    if [[ "$NO_OUTFILE" -eq 1 ]]; then
        cmd+=("--no-outfile")
    fi
    
    # Show configuration
    if [[ "$QUIET" -eq 0 ]]; then
        print_line "="
        echo -e "${BOLD}Solana Vanity Address Generator${NC}"
        print_line "="
        echo ""
        echo -e "Prefix:          ${CYAN}${PREFIX}${NC}"
        if [[ -n "$SUFFIX" ]]; then
            echo -e "Suffix:          ${CYAN}${SUFFIX}${NC}"
        fi
        echo -e "Count:           ${COUNT}"
        echo -e "Case-sensitive:  $([ "$IGNORE_CASE" -eq 0 ] && echo "Yes" || echo "No")"
        echo -e "Threads:         ${THREADS:-"all ($(get_cpu_cores) cores)"}"
        echo -e "Output:          $([ "$NO_OUTFILE" -eq 1 ] && echo "stdout" || echo "$OUTPUT_DIR")"
        if [[ "$ENCRYPT" -eq 1 ]]; then
            echo -e "Encryption:      ${GREEN}Yes (GPG)${NC}"
        fi
        echo ""
        
        # Show time estimate
        local case_flag=1
        [[ "$IGNORE_CASE" -eq 1 ]] && case_flag=0
        local total_len=${#PREFIX}
        [[ -n "$SUFFIX" ]] && total_len=$((total_len + ${#SUFFIX}))
        local estimate
        estimate=$(estimate_time "$total_len" "$case_flag" "${THREADS:-$(get_cpu_cores)}")
        echo -e "Estimated time:  ${YELLOW}${estimate}${NC}"
        echo ""
        print_line "-"
    fi
    
    log_debug "Running command: ${cmd[*]}"
    
    # Change to output directory if not using --no-outfile
    local original_dir
    original_dir=$(pwd)
    if [[ "$NO_OUTFILE" -eq 0 ]]; then
        cd "$OUTPUT_DIR"
    fi
    
    # Run the generation
    start_time=$(date +%s)
    
    if [[ "$QUIET" -eq 1 ]]; then
        "${cmd[@]}" 2>&1
    else
        "${cmd[@]}"
    fi
    
    local exit_code=$?
    
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    # Return to original directory
    cd "$original_dir"
    
    if [[ $exit_code -ne 0 ]]; then
        log_error "Generation failed with exit code: $exit_code"
        exit "$EXIT_SYSTEM_ERROR"
    fi
    
    if [[ "$QUIET" -eq 0 ]]; then
        echo ""
        print_line "-"
        echo -e "${GREEN}Generation completed in ${duration} seconds${NC}"
    fi
    
    # Post-processing for file output
    if [[ "$NO_OUTFILE" -eq 0 ]]; then
        post_process_files
    fi
}

post_process_files() {
    local backup_dir=""
    
    # Create backup directory if requested
    if [[ "$BACKUP" -eq 1 ]]; then
        backup_dir=$(create_backup_dir "$OUTPUT_DIR")
        log_info "Backup directory: $backup_dir"
    fi
    
    # Find generated files (they match the prefix pattern)
    local search_pattern
    if [[ "$IGNORE_CASE" -eq 1 ]]; then
        # Case insensitive - need to search for any case variation
        search_pattern="${OUTPUT_DIR}/*.json"
    else
        search_pattern="${OUTPUT_DIR}/${PREFIX}*.json"
    fi
    
    local found_files=0
    for keypair_file in $search_pattern; do
        [[ -f "$keypair_file" ]] || continue
        
        # Get public key and verify it matches
        local pubkey
        pubkey=$(get_pubkey_from_file "$keypair_file" 2>/dev/null) || continue
        
        # Check if this file matches our criteria
        local matches=0
        if [[ "$IGNORE_CASE" -eq 1 ]]; then
            if check_prefix_match "$pubkey" "$PREFIX" 0; then
                if [[ -z "$SUFFIX" ]] || check_suffix_match "$pubkey" "$SUFFIX" 0; then
                    matches=1
                fi
            fi
        else
            if check_prefix_match "$pubkey" "$PREFIX" 1; then
                if [[ -z "$SUFFIX" ]] || check_suffix_match "$pubkey" "$SUFFIX" 1; then
                    matches=1
                fi
            fi
        fi
        
        if [[ $matches -eq 0 ]]; then
            continue
        fi
        
        found_files=$((found_files + 1))
        GENERATED_FILES+=("$keypair_file")
        
        # Set secure permissions
        set_secure_permissions "$keypair_file"
        
        # Create backup if requested
        if [[ -n "$backup_dir" ]]; then
            cp "$keypair_file" "$backup_dir/"
            set_secure_permissions "${backup_dir}/$(basename "$keypair_file")"
            log_debug "Backed up: $(basename "$keypair_file")"
        fi
        
        # Encrypt if requested
        if [[ "$ENCRYPT" -eq 1 ]]; then
            if encrypt_with_gpg "$keypair_file"; then
                # Optionally remove the unencrypted file
                if confirm "Remove unencrypted file ${keypair_file}?"; then
                    secure_delete "$keypair_file"
                fi
            fi
        fi
        
        # Display info
        if [[ "$QUIET" -eq 0 ]]; then
            echo ""
            log_success "Generated keypair:"
            echo -e "  Public Key: ${CYAN}${pubkey}${NC}"
            echo -e "  File:       ${keypair_file}"
            
            # Verify file permissions
            if check_secure_permissions "$keypair_file" 2>/dev/null || [[ "$ENCRYPT" -eq 1 ]]; then
                echo -e "  Permissions: ${GREEN}Secure (600)${NC}"
            else
                echo -e "  Permissions: ${YELLOW}Check permissions!${NC}"
            fi
        fi
    done
    
    if [[ "$QUIET" -eq 0 ]]; then
        echo ""
        print_line "="
        log_info "Generated $found_files keypair(s)"
        if [[ -n "$backup_dir" ]]; then
            log_info "Backups saved to: $backup_dir"
        fi
        print_line "="
    fi
}

# ==============================================================================
# Main Entry Point
# ==============================================================================

main() {
    # Setup signal handlers
    setup_signal_handlers
    
    # Parse command line arguments
    parse_args "$@"
    
    # Check dependencies
    check_solana_keygen
    
    # Validate all inputs
    validate_inputs
    
    # Run the generator
    generate_vanity_address
    
    exit "$EXIT_SUCCESS"
}

# Run main function
main "$@"
