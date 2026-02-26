#!/usr/bin/env python3
"""
Fuzz test file operations across all implementations.

Tests various file paths to ensure proper handling of:
- Paths with spaces
- Paths with special characters
- Symlinks
- Non-writable directories
- Existing files
- Very long paths
"""

import subprocess
import sys
import os
import tempfile
import shutil
import stat
from typing import List, Tuple, Callable

# Project root
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))

# Colors
GREEN = "\033[0;32m"
RED = "\033[0;31m"
YELLOW = "\033[0;33m"
NC = "\033[0m"


def log_pass(msg: str) -> None:
    print(f"{GREEN}✓ PASS{NC}: {msg}")


def log_fail(msg: str) -> None:
    print(f"{RED}✗ FAIL{NC}: {msg}")


def log_info(msg: str) -> None:
    print(f"{YELLOW}→{NC} {msg}")


class FileOperationTest:
    """Container for file operation tests."""
    
    def __init__(self):
        self.temp_base = tempfile.mkdtemp()
        self.failed = 0
        self.total = 0
        
    def cleanup(self):
        shutil.rmtree(self.temp_base, ignore_errors=True)
    
    def run_rust(self, output_path: str) -> Tuple[bool, str]:
        """Run Rust implementation and return (success, error_msg)."""
        rust_bin = os.path.join(PROJECT_ROOT, "rust", "target", "release", "solana-vanity")
        if not os.path.isfile(rust_bin):
            return (True, "skipped")  # Skip if not built
        
        try:
            result = subprocess.run(
                [rust_bin, "--prefix", "a", "--output", output_path, "--quiet"],
                capture_output=True,
                text=True,
                timeout=10
            )
            return (result.returncode == 0 and os.path.exists(output_path), result.stderr)
        except Exception as e:
            return (False, str(e))
    
    def run_typescript(self, output_path: str) -> Tuple[bool, str]:
        """Run TypeScript implementation and return (success, error_msg)."""
        ts_cli = os.path.join(PROJECT_ROOT, "typescript", "dist", "index.js")
        if not os.path.isfile(ts_cli):
            return (True, "skipped")
        
        try:
            result = subprocess.run(
                ["node", ts_cli, "--prefix", "a", "--output", output_path],
                capture_output=True,
                text=True,
                timeout=10
            )
            return (result.returncode == 0 and os.path.exists(output_path), result.stderr)
        except Exception as e:
            return (False, str(e))
    
    def test_path(self, name: str, path: str, should_succeed: bool, setup: Callable = None, cleanup: Callable = None):
        """Test a specific path with all implementations."""
        print(f"\nTesting: {name}")
        print(f"  Path: {path[:60]}{'...' if len(path) > 60 else ''}")
        print(f"  Expected: {'success' if should_succeed else 'failure'}")
        
        if setup:
            try:
                setup()
            except Exception as e:
                log_info(f"Setup failed: {e}")
                return
        
        try:
            # Test Rust
            self.total += 1
            rust_success, rust_msg = self.run_rust(path)
            if rust_msg == "skipped":
                log_info("Rust: skipped (not built)")
                self.total -= 1
            elif rust_success == should_succeed:
                log_pass(f"Rust: {'succeeded' if rust_success else 'failed'} as expected")
            else:
                log_fail(f"Rust: expected {'success' if should_succeed else 'failure'}, got {'success' if rust_success else 'failure'}")
                self.failed += 1
            
            # Clean up file if created
            if os.path.exists(path):
                try:
                    os.remove(path)
                except:
                    pass
            
            # Test TypeScript
            self.total += 1
            ts_success, ts_msg = self.run_typescript(path)
            if ts_msg == "skipped":
                log_info("TypeScript: skipped (not built)")
                self.total -= 1
            elif ts_success == should_succeed:
                log_pass(f"TypeScript: {'succeeded' if ts_success else 'failed'} as expected")
            else:
                log_fail(f"TypeScript: expected {'success' if should_succeed else 'failure'}, got {'success' if ts_success else 'failure'}")
                self.failed += 1
            
            # Clean up file if created
            if os.path.exists(path):
                try:
                    os.remove(path)
                except:
                    pass
                    
        finally:
            if cleanup:
                try:
                    cleanup()
                except:
                    pass
    
    def run_all_tests(self):
        """Run all file operation tests."""
        
        # 1. Normal path
        self.test_path(
            "Normal path",
            os.path.join(self.temp_base, "normal.json"),
            should_succeed=True
        )
        
        # 2. Path with spaces
        space_dir = os.path.join(self.temp_base, "path with spaces")
        os.makedirs(space_dir, exist_ok=True)
        self.test_path(
            "Path with spaces",
            os.path.join(space_dir, "key file.json"),
            should_succeed=True
        )
        
        # 3. Path with special characters
        special_dir = os.path.join(self.temp_base, "special-chars_123")
        os.makedirs(special_dir, exist_ok=True)
        self.test_path(
            "Path with special characters",
            os.path.join(special_dir, "key-file_v2.json"),
            should_succeed=True
        )
        
        # 4. Deeply nested path
        deep_path = self.temp_base
        for i in range(10):
            deep_path = os.path.join(deep_path, f"level{i}")
        os.makedirs(deep_path, exist_ok=True)
        self.test_path(
            "Deeply nested path",
            os.path.join(deep_path, "deep.json"),
            should_succeed=True
        )
        
        # 5. Non-writable directory
        readonly_dir = os.path.join(self.temp_base, "readonly")
        os.makedirs(readonly_dir, exist_ok=True)
        
        def make_readonly():
            os.chmod(readonly_dir, stat.S_IRUSR | stat.S_IXUSR)
        
        def make_writable():
            os.chmod(readonly_dir, stat.S_IRWXU)
        
        self.test_path(
            "Non-writable directory",
            os.path.join(readonly_dir, "key.json"),
            should_succeed=False,
            setup=make_readonly,
            cleanup=make_writable
        )
        
        # 6. Existing file (without --overwrite)
        existing_file = os.path.join(self.temp_base, "existing.json")
        with open(existing_file, 'w') as f:
            f.write('[]')
        self.test_path(
            "Existing file (no overwrite flag)",
            existing_file,
            should_succeed=False  # Should fail without overwrite flag
        )
        os.remove(existing_file) if os.path.exists(existing_file) else None
        
        # 7. Symlink to valid location
        symlink_dir = os.path.join(self.temp_base, "symlink_target")
        os.makedirs(symlink_dir, exist_ok=True)
        symlink_path = os.path.join(self.temp_base, "symlink")
        
        def create_symlink():
            if os.path.exists(symlink_path):
                os.remove(symlink_path)
            os.symlink(symlink_dir, symlink_path)
        
        def remove_symlink():
            if os.path.islink(symlink_path):
                os.remove(symlink_path)
        
        self.test_path(
            "Symlink to valid directory",
            os.path.join(symlink_path, "key.json"),
            should_succeed=True,
            setup=create_symlink,
            cleanup=remove_symlink
        )
        
        # 8. Very long filename
        long_name = "a" * 200 + ".json"
        self.test_path(
            "Very long filename",
            os.path.join(self.temp_base, long_name),
            should_succeed=False  # Most filesystems limit to 255 chars
        )
        
        # 9. Path with unicode
        unicode_dir = os.path.join(self.temp_base, "üñíçödé")
        try:
            os.makedirs(unicode_dir, exist_ok=True)
            self.test_path(
                "Unicode path",
                os.path.join(unicode_dir, "key.json"),
                should_succeed=True
            )
        except OSError:
            log_info("Unicode path: filesystem doesn't support unicode names")
        
        # 10. /dev/null
        self.test_path(
            "/dev/null",
            "/dev/null",
            should_succeed=False  # Should not write secrets to device files
        )


def main() -> int:
    print("==============================================")
    print("File Operations Fuzz Test Suite")
    print("==============================================")
    
    tester = FileOperationTest()
    
    try:
        tester.run_all_tests()
        
        print("\n==============================================")
        if tester.failed == 0:
            print(f"{GREEN}All {tester.total} file operation tests passed!{NC}")
            return 0
        else:
            print(f"{RED}{tester.failed}/{tester.total} file operation tests failed{NC}")
            return 1
            
    finally:
        tester.cleanup()


if __name__ == "__main__":
    sys.exit(main())
