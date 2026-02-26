#!/bin/bash
# ==============================================================================
# Solana Batch Vanity Address Generator
# ==============================================================================
# Generate multiple vanity addresses from a list of prefixes
# Features:
# - Read prefixes from input file
# - Parallel generation with job control
# - Progress tracking
# - Summary report
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
DEFAULT_OUTPUT_DIR="./batch_output"
DEFAULT_PARALLEL_JOBS=1
DEFAULT_COUNT_PER_PREFIX=1

# ==============================================================================
# Help and Usage
# ==============================================================================

show_help() {
    cat << EOF
${BOLD}Solana Batch Vanity Address Generator${NC}
Version: ${VERSION}

${BOLD}USAGE:${NC}
    $SCRIPT_NAME [OPTIONS] <prefix-file>

${BOLD}ARGUMENTS:${NC}
    <prefix-file>         File containing prefixes (one per line)

${BOLD}OPTIONS:${NC}
    -o, --output <dir>    Output directory (default: $DEFAULT_OUTPUT_DIR)
    -j, --jobs <n>        Parallel jobs (default: $DEFAULT_PARALLEL_JOBS)
    -c, --count <n>       Addresses per prefix (default: $DEFAULT_COUNT_PER_PREFIX)
    -i, --ignore-case     Case-insensitive matching
    -e, --encrypt         Encrypt outputs with GPG
    -r, --resume          Resume from last failed prefix
    -v, --verbose         Verbose output
    -q, --quiet           Quiet mode (minimal output)
    -h, --help            Show this help message
    --version             Show version

${BOLD}PREFIX FILE FORMAT:${NC}
    One prefix per line, optionally followed by a colon and count:
    
    # Example prefix-file.txt
    Sol
    Pay:3
    App
    Dex:2
    
    Lines starting with # are comments.
    Empty lines are ignored.

${BOLD}EXAMPLES:${NC}
    # Generate from file
    $SCRIPT_NAME prefixes.txt

    # Generate with 2 parallel jobs
    $SCRIPT_NAME -j 2 prefixes.txt

    # Generate to specific directory, case-insensitive
    $SCRIPT_NAME -o ./keys -i prefixes.txt

    # Resume interrupted batch
    $SCRIPT_NAME -r prefixes.txt

${BOLD}OUTPUT STRUCTURE:${NC}
    batch_output/
    ├── Sol/
    │   └── SOLabcXYZ...json
    ├── Pay/
    │   ├── PAYdef123...json
    │   └── PAYghi456...json
    └── batch_report.txt

EOF
}

show_version() {
    echo "$SCRIPT_NAME version $VERSION"
}

# ==============================================================================
# Argument Parsing
# ==============================================================================

PREFIX_FILE=""
OUTPUT_DIR="$DEFAULT_OUTPUT_DIR"
PARALLEL_JOBS="$DEFAULT_PARALLEL_JOBS"
COUNT_PER_PREFIX="$DEFAULT_COUNT_PER_PREFIX"
IGNORE_CASE=0
ENCRYPT=0
RESUME=0

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -o|--output)
                if [[ -z "${2:-}" ]]; then
                    log_error "Option $1 requires an argument"
                    exit "$EXIT_USER_ERROR"
                fi
                OUTPUT_DIR="$2"
                shift 2
                ;;
            -j|--jobs)
                if [[ -z "${2:-}" ]]; then
                    log_error "Option $1 requires an argument"
                    exit "$EXIT_USER_ERROR"
                fi
                if ! [[ "$2" =~ ^[0-9]+$ ]] || [[ "$2" -lt 1 ]]; then
                    log_error "Jobs must be a positive integer"
                    exit "$EXIT_USER_ERROR"
                fi
                PARALLEL_JOBS="$2"
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
                COUNT_PER_PREFIX="$2"
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
            -r|--resume)
                RESUME=1
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
                if [[ -z "$PREFIX_FILE" ]]; then
                    PREFIX_FILE="$1"
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
# Prefix File Parsing
# ==============================================================================

# Array to hold prefixes and their counts
declare -a PREFIXES
declare -A PREFIX_COUNTS

parse_prefix_file() {
    local file="$1"
    local line_num=0
    local valid_count=0
    
    while IFS= read -r line || [[ -n "$line" ]]; do
        line_num=$((line_num + 1))
        
        # Skip empty lines and comments
        line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        [[ -z "$line" ]] && continue
        [[ "$line" =~ ^# ]] && continue
        
        # Parse prefix and optional count (format: PREFIX or PREFIX:COUNT)
        local prefix count
        if [[ "$line" =~ : ]]; then
            prefix="${line%%:*}"
            count="${line#*:}"
            if ! [[ "$count" =~ ^[0-9]+$ ]]; then
                log_warn "Line $line_num: Invalid count '$count', using default"
                count="$COUNT_PER_PREFIX"
            fi
        else
            prefix="$line"
            count="$COUNT_PER_PREFIX"
        fi
        
        # Validate prefix
        if ! is_valid_base58 "$prefix"; then
            local invalid_chars
            invalid_chars=$(get_invalid_chars "$prefix")
            log_error "Line $line_num: Invalid Base58 characters in prefix '$prefix': '$invalid_chars'"
            continue
        fi
        
        PREFIXES+=("$prefix")
        PREFIX_COUNTS["$prefix"]="$count"
        valid_count=$((valid_count + 1))
        log_debug "Parsed prefix: $prefix (count: $count)"
        
    done < "$file"
    
    if [[ $valid_count -eq 0 ]]; then
        log_error "No valid prefixes found in $file"
        exit "$EXIT_USER_ERROR"
    fi
    
    log_info "Loaded $valid_count valid prefix(es) from $file"
}

# ==============================================================================
# Generation Functions
# ==============================================================================

# Tracking variables
declare -A RESULTS
COMPLETED_COUNT=0
FAILED_COUNT=0
SKIPPED_COUNT=0
START_TIME=""

# Progress file for resume functionality
PROGRESS_FILE=""

init_batch() {
    # Create output directory
    mkdir -p "$OUTPUT_DIR"
    chmod 700 "$OUTPUT_DIR"
    
    # Initialize progress file
    PROGRESS_FILE="${OUTPUT_DIR}/.batch_progress"
    
    # If not resuming, clear progress file
    if [[ "$RESUME" -eq 0 ]] && [[ -f "$PROGRESS_FILE" ]]; then
        rm -f "$PROGRESS_FILE"
    fi
    
    START_TIME=$(date +%s)
    
    log_info "Output directory: $OUTPUT_DIR"
    log_info "Parallel jobs: $PARALLEL_JOBS"
}

is_prefix_completed() {
    local prefix="$1"
    
    if [[ ! -f "$PROGRESS_FILE" ]]; then
        return 1
    fi
    
    grep -q "^COMPLETED:$prefix$" "$PROGRESS_FILE"
}

mark_prefix_completed() {
    local prefix="$1"
    echo "COMPLETED:$prefix" >> "$PROGRESS_FILE"
}

mark_prefix_failed() {
    local prefix="$1"
    local error="$2"
    echo "FAILED:$prefix:$error" >> "$PROGRESS_FILE"
}

generate_for_prefix() {
    local prefix="$1"
    local count="${PREFIX_COUNTS[$prefix]}"
    local prefix_dir="${OUTPUT_DIR}/${prefix}"
    
    # Check if already completed (resume mode)
    if [[ "$RESUME" -eq 1 ]] && is_prefix_completed "$prefix"; then
        log_info "[$prefix] Skipping (already completed)"
        RESULTS["$prefix"]="SKIPPED"
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
        return 0
    fi
    
    # Create prefix directory
    mkdir -p "$prefix_dir"
    chmod 700 "$prefix_dir"
    
    log_info "[$prefix] Generating $count address(es)..."
    
    # Build command
    local cmd=("solana-keygen" "grind" "--starts-with" "${prefix}:${count}")
    
    if [[ "$IGNORE_CASE" -eq 1 ]]; then
        cmd+=("--ignore-case")
    fi
    
    # Run generation in prefix directory
    local original_dir
    original_dir=$(pwd)
    cd "$prefix_dir"
    
    local exit_code=0
    if [[ "$VERBOSE" -eq 1 ]]; then
        "${cmd[@]}" || exit_code=$?
    else
        "${cmd[@]}" > /dev/null 2>&1 || exit_code=$?
    fi
    
    cd "$original_dir"
    
    if [[ $exit_code -ne 0 ]]; then
        RESULTS["$prefix"]="FAILED"
        FAILED_COUNT=$((FAILED_COUNT + 1))
        mark_prefix_failed "$prefix" "Exit code $exit_code"
        log_error "[$prefix] Generation failed"
        return 1
    fi
    
    # Post-process: set permissions and optionally encrypt
    local generated_count=0
    for keypair_file in "${prefix_dir}"/*.json; do
        [[ -f "$keypair_file" ]] || continue
        
        chmod 600 "$keypair_file"
        generated_count=$((generated_count + 1))
        
        if [[ "$ENCRYPT" -eq 1 ]]; then
            if gpg --symmetric --cipher-algo AES256 --batch --yes --output "${keypair_file}.gpg" "$keypair_file" 2>/dev/null; then
                chmod 600 "${keypair_file}.gpg"
                secure_delete "$keypair_file"
            else
                log_warn "[$prefix] Failed to encrypt $(basename "$keypair_file")"
            fi
        fi
    done
    
    RESULTS["$prefix"]="SUCCESS:$generated_count"
    COMPLETED_COUNT=$((COMPLETED_COUNT + 1))
    mark_prefix_completed "$prefix"
    log_success "[$prefix] Generated $generated_count address(es)"
    
    return 0
}

run_batch_generation() {
    local total=${#PREFIXES[@]}
    local current=0
    
    if [[ "$QUIET" -eq 0 ]]; then
        print_line "="
        echo -e "${BOLD}Batch Vanity Address Generation${NC}"
        print_line "="
        echo ""
        echo -e "Total prefixes:   ${CYAN}$total${NC}"
        echo -e "Parallel jobs:    ${PARALLEL_JOBS}"
        echo -e "Case-sensitive:   $([ "$IGNORE_CASE" -eq 0 ] && echo "Yes" || echo "No")"
        echo -e "Encryption:       $([ "$ENCRYPT" -eq 1 ] && echo "Yes" || echo "No")"
        echo -e "Resume mode:      $([ "$RESUME" -eq 1 ] && echo "Yes" || echo "No")"
        echo ""
        print_line "-"
    fi
    
    if [[ "$PARALLEL_JOBS" -eq 1 ]]; then
        # Sequential processing
        for prefix in "${PREFIXES[@]}"; do
            current=$((current + 1))
            if [[ "$QUIET" -eq 0 ]]; then
                echo -e "\n${BOLD}[${current}/${total}]${NC} Processing: ${CYAN}${prefix}${NC}"
            fi
            generate_for_prefix "$prefix" || true
        done
    else
        # Parallel processing with job control
        local running_jobs=0
        local pids=()
        
        for prefix in "${PREFIXES[@]}"; do
            current=$((current + 1))
            
            # Wait if we've reached max parallel jobs
            while [[ $running_jobs -ge $PARALLEL_JOBS ]]; do
                # Wait for any job to complete
                wait -n "${pids[@]}" 2>/dev/null || true
                running_jobs=$((running_jobs - 1))
            done
            
            if [[ "$QUIET" -eq 0 ]]; then
                echo -e "[${current}/${total}] Starting: ${CYAN}${prefix}${NC}"
            fi
            
            # Start job in background
            generate_for_prefix "$prefix" &
            pids+=($!)
            running_jobs=$((running_jobs + 1))
        done
        
        # Wait for all remaining jobs
        for pid in "${pids[@]}"; do
            wait "$pid" 2>/dev/null || true
        done
    fi
}

# ==============================================================================
# Report Functions
# ==============================================================================

generate_report() {
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    local report_file="${OUTPUT_DIR}/batch_report.txt"
    
    # Generate report file
    {
        echo "========================================"
        echo "Batch Generation Report"
        echo "========================================"
        echo ""
        echo "Generated: $(date)"
        echo "Duration: ${duration} seconds"
        echo ""
        echo "Summary:"
        echo "  Total prefixes: ${#PREFIXES[@]}"
        echo "  Completed: $COMPLETED_COUNT"
        echo "  Failed: $FAILED_COUNT"
        echo "  Skipped: $SKIPPED_COUNT"
        echo ""
        echo "----------------------------------------"
        echo "Results by prefix:"
        echo "----------------------------------------"
        
        for prefix in "${PREFIXES[@]}"; do
            local result="${RESULTS[$prefix]:-UNKNOWN}"
            echo "  $prefix: $result"
        done
        
        echo ""
        echo "========================================"
    } > "$report_file"
    
    chmod 644 "$report_file"
    
    # Display summary
    if [[ "$QUIET" -eq 0 ]]; then
        echo ""
        print_line "="
        echo -e "${BOLD}Batch Generation Complete${NC}"
        print_line "="
        echo ""
        echo -e "Duration:    ${duration} seconds"
        echo -e "Completed:   ${GREEN}${COMPLETED_COUNT}${NC}"
        echo -e "Failed:      ${RED}${FAILED_COUNT}${NC}"
        echo -e "Skipped:     ${YELLOW}${SKIPPED_COUNT}${NC}"
        echo ""
        echo -e "Report:      ${CYAN}${report_file}${NC}"
        echo -e "Output:      ${CYAN}${OUTPUT_DIR}${NC}"
        print_line "="
    fi
}

# ==============================================================================
# Cleanup
# ==============================================================================

cleanup() {
    # Remove progress file on clean exit
    if [[ "$FAILED_COUNT" -eq 0 ]] && [[ -f "$PROGRESS_FILE" ]]; then
        rm -f "$PROGRESS_FILE"
    fi
    log_debug "Cleanup complete"
}

# ==============================================================================
# Main Entry Point
# ==============================================================================

main() {
    # Setup signal handlers
    setup_signal_handlers
    
    # Parse command line arguments
    parse_args "$@"
    
    # Validate prefix file argument
    if [[ -z "$PREFIX_FILE" ]]; then
        log_error "Prefix file is required"
        echo "Use --help for usage information"
        exit "$EXIT_USER_ERROR"
    fi
    
    if [[ ! -f "$PREFIX_FILE" ]]; then
        log_error "Prefix file not found: $PREFIX_FILE"
        exit "$EXIT_USER_ERROR"
    fi
    
    # Check dependencies
    check_solana_keygen
    
    if [[ "$ENCRYPT" -eq 1 ]] && ! command -v gpg &> /dev/null; then
        log_error "GPG not found. Cannot encrypt output."
        exit "$EXIT_SYSTEM_ERROR"
    fi
    
    # Parse prefix file
    parse_prefix_file "$PREFIX_FILE"
    
    # Initialize batch processing
    init_batch
    
    # Run batch generation
    run_batch_generation
    
    # Generate report
    generate_report
    
    # Exit with appropriate code
    if [[ "$FAILED_COUNT" -gt 0 ]]; then
        exit "$EXIT_USER_ERROR"
    fi
    
    exit "$EXIT_SUCCESS"
}

# Run main function
main "$@"
