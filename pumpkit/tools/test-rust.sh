#!/bin/bash
# Test script for solana-vanity Rust implementation
# Run this to verify the implementation

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUST_DIR="$SCRIPT_DIR/../rust"

echo "=================================="
echo "Solana Vanity Generator - Test Suite"
echo "=================================="

cd "$RUST_DIR"

# Check if cargo is available
if ! command -v cargo &> /dev/null; then
    echo "Error: cargo is not installed"
    echo "Install Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

echo ""
echo "1. Running cargo fmt check..."
cargo fmt -- --check || echo "Warning: Code not formatted (run 'cargo fmt')"

echo ""
echo "2. Running cargo clippy..."
cargo clippy -- -D warnings || echo "Warning: Clippy warnings found"

echo ""
echo "3. Building release..."
cargo build --release

echo ""
echo "4. Running unit tests (10 iterations)..."
for i in {1..10}; do
    echo "  Test iteration $i/10..."
    cargo test --lib -- --test-threads=1 || exit 1
done

echo ""
echo "5. Running integration tests (10 iterations)..."
for i in {1..10}; do
    echo "  Integration test iteration $i/10..."
    cargo test --test integration_tests -- --test-threads=1 || exit 1
done

echo ""
echo "6. Running security tests (10 iterations)..."
for i in {1..10}; do
    echo "  Security test iteration $i/10..."
    cargo test --test security_tests -- --test-threads=1 || exit 1
done

echo ""
echo "7. Running performance tests..."
cargo test --test performance_tests -- --nocapture

echo ""
echo "8. Running benchmarks..."
cargo bench || echo "Warning: Benchmarks may take a long time"

echo ""
echo "=================================="
echo "All tests passed!"
echo "=================================="

# Quick functional test
echo ""
echo "9. Quick functional test..."
./target/release/solana-vanity --prefix A --dry-run

echo ""
echo "10. Generate a test address..."
./target/release/solana-vanity --prefix A --verbose

echo ""
echo "=================================="
echo "Full validation complete!"
echo "=================================="
