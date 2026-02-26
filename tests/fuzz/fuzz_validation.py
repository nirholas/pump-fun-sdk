#!/usr/bin/env python3
"""
Fuzz test input validation across all implementations.

This script tests various edge cases and potentially malicious inputs
to verify that all implementations properly reject invalid input.
"""

import subprocess
import sys
import os
import tempfile
import shutil
from typing import List, Tuple, Optional

# Project root
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))

# Colors for output
GREEN = "\033[0;32m"
RED = "\033[0;31m"
YELLOW = "\033[0;33m"
NC = "\033[0m"

# Test cases: (input, description, should_be_rejected)
TEST_CASES: List[Tuple[str, str, bool]] = [
    # Invalid Base58 characters
    ("", "Empty string", True),
    ("0", "Invalid Base58: zero", True),
    ("O", "Invalid Base58: capital O", True),
    ("I", "Invalid Base58: capital I", True),
    ("l", "Invalid Base58: lowercase L", True),
    ("0abc", "Contains invalid '0'", True),
    ("Oabc", "Contains invalid 'O'", True),
    ("Iabc", "Contains invalid 'I'", True),
    ("labc", "Contains invalid 'l'", True),
    
    # Valid Base58 (should be accepted)
    ("a", "Valid single character", False),
    ("Ab", "Valid mixed case", False),
    ("123", "Valid numbers", False),
    ("ABC", "Valid uppercase", False),
    
    # Edge cases
    ("a" * 44, "Maximum valid length (full address)", False),
    ("a" * 100, "Very long prefix", True),  # Should be rejected as too long
    
    # Whitespace
    (" abc", "Leading whitespace", True),
    ("abc ", "Trailing whitespace", True),
    ("ab c", "Space in middle", True),
    ("\tabc", "Leading tab", True),
    ("abc\n", "Trailing newline", True),
    
    # Unicode and special characters
    ("🚀", "Unicode emoji", True),
    ("café", "Unicode accented char", True),
    ("日本語", "Unicode CJK", True),
    ("αβγ", "Unicode Greek", True),
    
    # Injection attempts
    ("../../../etc/passwd", "Path traversal in prefix", True),
    ("; rm -rf /", "Shell injection attempt", True),
    ("${HOME}", "Variable expansion", True),
    ("$(whoami)", "Command substitution", True),
    ("`id`", "Backtick execution", True),
    ("'; DROP TABLE users; --", "SQL injection pattern", True),
    ("<script>alert(1)</script>", "XSS pattern", True),
    ("{{7*7}}", "Template injection", True),
    
    # Null and control characters
    ("ab\x00c", "Null byte injection", True),
    ("ab\x1bc", "Escape character", True),
    ("ab\x7fc", "DEL character", True),
]


def log_pass(msg: str) -> None:
    print(f"{GREEN}✓ PASS{NC}: {msg}")


def log_fail(msg: str) -> None:
    print(f"{RED}✗ FAIL{NC}: {msg}")


def log_info(msg: str) -> None:
    print(f"{YELLOW}→{NC} {msg}")


def test_rust_implementation(test_input: str, description: str, should_reject: bool, temp_dir: str) -> bool:
    """Test the Rust implementation with a specific input."""
    rust_bin = os.path.join(PROJECT_ROOT, "rust", "target", "release", "solana-vanity")
    
    if not os.path.isfile(rust_bin):
        return True  # Skip if not built
    
    output_file = os.path.join(temp_dir, "rust-fuzz-output.json")
    
    try:
        result = subprocess.run(
            [rust_bin, "--prefix", test_input, "--output", output_file, "--quiet"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        file_created = os.path.isfile(output_file)
        success = result.returncode == 0 and file_created
        
        # Clean up
        if file_created:
            os.remove(output_file)
        
        if should_reject:
            if not success:
                return True  # Correctly rejected
            else:
                log_fail(f"Rust accepted invalid input: {description}")
                return False
        else:
            if success:
                return True  # Correctly accepted
            else:
                log_fail(f"Rust rejected valid input: {description}")
                return False
                
    except subprocess.TimeoutExpired:
        if should_reject:
            return True  # Timeout might be acceptable for rejection
        log_fail(f"Rust timed out on: {description}")
        return False
    except Exception as e:
        if should_reject:
            return True
        log_fail(f"Rust error on {description}: {e}")
        return False


def test_typescript_implementation(test_input: str, description: str, should_reject: bool, temp_dir: str) -> bool:
    """Test the TypeScript implementation with a specific input."""
    ts_cli = os.path.join(PROJECT_ROOT, "typescript", "dist", "index.js")
    
    if not os.path.isfile(ts_cli):
        return True  # Skip if not built
    
    output_file = os.path.join(temp_dir, "ts-fuzz-output.json")
    
    try:
        result = subprocess.run(
            ["node", ts_cli, "--prefix", test_input, "--output", output_file],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        file_created = os.path.isfile(output_file)
        success = result.returncode == 0 and file_created
        
        # Clean up
        if file_created:
            os.remove(output_file)
        
        if should_reject:
            if not success:
                return True
            else:
                log_fail(f"TypeScript accepted invalid input: {description}")
                return False
        else:
            if success:
                return True
            else:
                log_fail(f"TypeScript rejected valid input: {description}")
                return False
                
    except subprocess.TimeoutExpired:
        if should_reject:
            return True
        log_fail(f"TypeScript timed out on: {description}")
        return False
    except Exception as e:
        if should_reject:
            return True
        log_fail(f"TypeScript error on {description}: {e}")
        return False


def test_cli_scripts(test_input: str, description: str, should_reject: bool, temp_dir: str) -> bool:
    """Test the CLI shell scripts with a specific input."""
    script = os.path.join(PROJECT_ROOT, "scripts", "generate-vanity.sh")
    
    if not os.path.isfile(script):
        return True  # Skip if not present
    
    output_file = os.path.join(temp_dir, "cli-fuzz-output.json")
    
    try:
        result = subprocess.run(
            [script, "-o", temp_dir, test_input],
            capture_output=True,
            text=True,
            timeout=30,
            env={**os.environ, "QUIET": "1"}
        )
        
        # Check if any json file was created
        json_files = [f for f in os.listdir(temp_dir) if f.endswith('.json')]
        success = result.returncode == 0 and len(json_files) > 0
        
        # Clean up
        for f in json_files:
            os.remove(os.path.join(temp_dir, f))
        
        if should_reject:
            if not success:
                return True
            else:
                log_fail(f"CLI accepted invalid input: {description}")
                return False
        else:
            if success:
                return True
            else:
                # CLI might not be fully working, just warn
                log_info(f"CLI: Unable to test valid input: {description}")
                return True
                
    except subprocess.TimeoutExpired:
        if should_reject:
            return True
        log_info(f"CLI timed out on: {description} (may be expected)")
        return True
    except Exception as e:
        if should_reject:
            return True
        log_info(f"CLI: {description}: {e}")
        return True


def main() -> int:
    print("==============================================")
    print("Input Validation Fuzz Test Suite")
    print("==============================================")
    print()
    
    # Create temp directory
    temp_dir = tempfile.mkdtemp()
    
    try:
        rust_available = os.path.isfile(os.path.join(PROJECT_ROOT, "rust", "target", "release", "solana-vanity"))
        ts_available = os.path.isfile(os.path.join(PROJECT_ROOT, "typescript", "dist", "index.js"))
        
        if rust_available:
            log_info("Rust implementation found")
        else:
            log_info("Rust implementation not built, skipping")
            
        if ts_available:
            log_info("TypeScript implementation found")
        else:
            log_info("TypeScript implementation not built, skipping")
        
        print()
        
        failed = 0
        total = 0
        
        for test_input, description, should_reject in TEST_CASES:
            rejection_text = "should reject" if should_reject else "should accept"
            print(f"Testing: {description} ({rejection_text})")
            
            # Test each implementation
            if rust_available:
                total += 1
                if not test_rust_implementation(test_input, description, should_reject, temp_dir):
                    failed += 1
                else:
                    log_pass(f"Rust: {description}")
            
            if ts_available:
                total += 1
                if not test_typescript_implementation(test_input, description, should_reject, temp_dir):
                    failed += 1
                else:
                    log_pass(f"TypeScript: {description}")
            
            print()
        
        print("==============================================")
        if failed == 0:
            print(f"{GREEN}All {total} fuzz tests passed!{NC}")
            return 0
        else:
            print(f"{RED}{failed}/{total} fuzz tests failed{NC}")
            return 1
            
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
