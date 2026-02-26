# ==============================================================================
# Solana Vanity Address Toolkit - Makefile
# ==============================================================================
# Targets:
#   install-deps  - Install Solana CLI tools
#   generate      - Interactive vanity address generation
#   verify        - Verify a keypair file
#   batch         - Batch generation from file
#   test          - Run all tests
#   test-gen      - Run generation tests
#   test-verify   - Run verification tests
#   lint          - Run shellcheck on all scripts
#   clean         - Secure deletion of test files
#   help          - Show this help message
# ==============================================================================

.PHONY: all install-deps generate verify batch test test-gen test-verify lint clean help

# Configuration
SHELL := /bin/bash
SCRIPTS_DIR := scripts
TESTS_DIR := tests/cli
DOCS_DIR := docs
FIXTURES_DIR := $(TESTS_DIR)/fixtures

# Colors
CYAN := \033[0;36m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m
BOLD := \033[1m

# Default target
all: help

# ==============================================================================
# Installation
# ==============================================================================

## Install Solana CLI tools
install-deps:
	@echo -e "$(BOLD)Installing Solana CLI tools...$(NC)"
	@if command -v solana-keygen &> /dev/null; then \
		echo -e "$(GREEN)Solana CLI already installed$(NC)"; \
		solana --version; \
	else \
		echo "Downloading and installing Solana CLI..."; \
		sh -c "$$(curl -sSfL https://release.solana.com/stable/install)"; \
		echo ""; \
		echo -e "$(YELLOW)Add Solana to your PATH:$(NC)"; \
		echo 'export PATH="$$HOME/.local/share/solana/install/active_release/bin:$$PATH"'; \
	fi

## Check if all dependencies are installed
check-deps:
	@echo -e "$(BOLD)Checking dependencies...$(NC)"
	@command -v solana-keygen &> /dev/null || { echo -e "$(RED)solana-keygen not found$(NC)"; exit 1; }
	@command -v python3 &> /dev/null || { echo -e "$(RED)python3 not found$(NC)"; exit 1; }
	@echo -e "$(GREEN)All dependencies found$(NC)"
	@echo -n "  solana-keygen: "; solana-keygen --version 2>/dev/null || echo "error"
	@echo -n "  python3: "; python3 --version

# ==============================================================================
# Generation Commands
# ==============================================================================

## Interactive vanity address generation
generate:
	@echo -e "$(BOLD)Solana Vanity Address Generator$(NC)"
	@echo ""
	@read -p "Enter prefix: " prefix; \
	read -p "Number to generate [1]: " count; \
	count=$${count:-1}; \
	read -p "Case insensitive? [y/N]: " ignore_case; \
	opts=""; \
	if [[ "$$ignore_case" =~ ^[yY] ]]; then opts="-i"; fi; \
	./$(SCRIPTS_DIR)/generate-vanity.sh $$opts -c $$count "$$prefix"

## Verify a keypair file
verify:
	@echo -e "$(BOLD)Keypair Verification$(NC)"
	@echo ""
	@read -p "Enter keypair file path: " file; \
	read -p "Expected prefix (optional): " prefix; \
	opts=""; \
	if [[ -n "$$prefix" ]]; then opts="-p $$prefix"; fi; \
	./$(SCRIPTS_DIR)/verify-keypair.sh $$opts "$$file"

## Batch generation from file
batch:
	@echo -e "$(BOLD)Batch Vanity Address Generation$(NC)"
	@echo ""
	@read -p "Enter prefix file path: " file; \
	read -p "Parallel jobs [1]: " jobs; \
	jobs=$${jobs:-1}; \
	./$(SCRIPTS_DIR)/batch-generate.sh -j $$jobs "$$file"

# ==============================================================================
# Quick Generation Shortcuts
# ==============================================================================

## Generate a single 2-character prefix (quick test)
quick:
	@./$(SCRIPTS_DIR)/generate-vanity.sh -c 1 AB

## Generate with a custom prefix (usage: make PREFIX=Sol vanity)
vanity:
ifndef PREFIX
	@echo -e "$(RED)PREFIX not set. Usage: make PREFIX=Sol vanity$(NC)"
	@exit 1
endif
	@./$(SCRIPTS_DIR)/generate-vanity.sh $(PREFIX)

# ==============================================================================
# Testing
# ==============================================================================

## Run all tests
test: check-deps lint test-gen test-verify
	@echo ""
	@echo -e "$(GREEN)$(BOLD)All tests passed!$(NC)"

## Run generation tests
test-gen:
	@echo -e "$(BOLD)Running generation tests...$(NC)"
	@chmod +x $(TESTS_DIR)/test_generation.sh
	@./$(TESTS_DIR)/test_generation.sh

## Run verification tests
test-verify:
	@echo -e "$(BOLD)Running verification tests...$(NC)"
	@chmod +x $(TESTS_DIR)/test_verification.sh
	@./$(TESTS_DIR)/test_verification.sh

## Run tests multiple times for consistency
test-repeat:
	@echo -e "$(BOLD)Running tests 10 times...$(NC)"
	@for i in $$(seq 1 10); do \
		echo -e "\n$(CYAN)Test run $$i/10$(NC)"; \
		$(MAKE) -s test || exit 1; \
	done
	@echo -e "\n$(GREEN)$(BOLD)All 10 test runs passed!$(NC)"

# ==============================================================================
# Code Quality
# ==============================================================================

## Run shellcheck on all scripts
lint:
	@echo -e "$(BOLD)Running shellcheck...$(NC)"
	@if command -v shellcheck &> /dev/null; then \
		shellcheck -x $(SCRIPTS_DIR)/*.sh $(TESTS_DIR)/*.sh 2>/dev/null && \
		echo -e "$(GREEN)All scripts pass shellcheck$(NC)" || \
		{ echo -e "$(RED)Shellcheck found issues$(NC)"; exit 1; }; \
	else \
		echo -e "$(YELLOW)shellcheck not installed, skipping...$(NC)"; \
		echo "Install with: apt install shellcheck (or brew install shellcheck)"; \
	fi

## Format check (placeholder for future formatters)
format-check:
	@echo -e "$(BOLD)Format check$(NC)"
	@echo "Shell scripts don't have a standard formatter, but ensure:"
	@echo "  - Consistent indentation (2 or 4 spaces)"
	@echo "  - No trailing whitespace"
	@echo "  - LF line endings"

# ==============================================================================
# Cleanup
# ==============================================================================

## Secure deletion of test files and generated keypairs
clean:
	@echo -e "$(BOLD)Cleaning up...$(NC)"
	@echo -e "$(YELLOW)Warning: This will securely delete test fixtures and generated files$(NC)"
	@read -p "Continue? [y/N]: " confirm; \
	if [[ "$$confirm" =~ ^[yY] ]]; then \
		echo "Cleaning test fixtures..."; \
		if [[ -d "$(FIXTURES_DIR)" ]]; then \
			find $(FIXTURES_DIR) -name "*.json" -type f -exec sh -c '\
				if command -v shred &> /dev/null; then \
					shred -fz -n 3 "$$1" 2>/dev/null; \
				fi; \
				rm -f "$$1"' _ {} \; ; \
		fi; \
		echo "Cleaning batch output..."; \
		if [[ -d "batch_output" ]]; then \
			find batch_output -name "*.json" -type f -exec sh -c '\
				if command -v shred &> /dev/null; then \
					shred -fz -n 3 "$$1" 2>/dev/null; \
				fi; \
				rm -f "$$1"' _ {} \; ; \
			rm -rf batch_output; \
		fi; \
		echo -e "$(GREEN)Cleanup complete$(NC)"; \
	else \
		echo "Cleanup cancelled"; \
	fi

## Clean only test fixtures (non-interactive)
clean-fixtures:
	@echo "Cleaning test fixtures..."
	@mkdir -p $(FIXTURES_DIR)
	@find $(FIXTURES_DIR) -name "*.json" -type f -delete 2>/dev/null || true
	@echo "Done"

# ==============================================================================
# Setup
# ==============================================================================

## Initial setup - create directories and set permissions
setup:
	@echo -e "$(BOLD)Setting up project...$(NC)"
	@mkdir -p $(SCRIPTS_DIR) $(TESTS_DIR) $(FIXTURES_DIR) $(DOCS_DIR)
	@chmod +x $(SCRIPTS_DIR)/*.sh 2>/dev/null || true
	@chmod +x $(TESTS_DIR)/*.sh 2>/dev/null || true
	@echo -e "$(GREEN)Setup complete$(NC)"

## Make all scripts executable
chmod:
	@chmod +x $(SCRIPTS_DIR)/*.sh
	@chmod +x $(TESTS_DIR)/*.sh
	@echo -e "$(GREEN)Scripts are now executable$(NC)"

# ==============================================================================
# Documentation
# ==============================================================================

## Open documentation
docs:
	@if command -v xdg-open &> /dev/null; then \
		xdg-open $(DOCS_DIR)/cli-guide.md; \
	elif command -v open &> /dev/null; then \
		open $(DOCS_DIR)/cli-guide.md; \
	else \
		cat $(DOCS_DIR)/cli-guide.md; \
	fi

# ==============================================================================
# Help
# ==============================================================================

## Show this help message
help:
	@echo ""
	@echo -e "$(BOLD)Solana Vanity Address Toolkit$(NC)"
	@echo ""
	@echo -e "$(CYAN)Usage:$(NC) make [target]"
	@echo ""
	@echo -e "$(CYAN)Installation:$(NC)"
	@echo "  install-deps     Install Solana CLI tools"
	@echo "  check-deps       Check if dependencies are installed"
	@echo "  setup            Create directories and set permissions"
	@echo ""
	@echo -e "$(CYAN)Generation:$(NC)"
	@echo "  generate         Interactive vanity address generation"
	@echo "  verify           Verify a keypair file"
	@echo "  batch            Batch generation from prefix file"
	@echo "  quick            Quick test with 2-char prefix"
	@echo "  vanity           Generate with PREFIX=xxx (e.g., make PREFIX=Sol vanity)"
	@echo ""
	@echo -e "$(CYAN)Testing:$(NC)"
	@echo "  test             Run all tests"
	@echo "  test-gen         Run generation tests only"
	@echo "  test-verify      Run verification tests only"
	@echo "  test-repeat      Run tests 10 times for consistency"
	@echo "  lint             Run shellcheck on all scripts"
	@echo ""
	@echo -e "$(CYAN)Maintenance:$(NC)"
	@echo "  clean            Secure deletion of test files"
	@echo "  clean-fixtures   Clean test fixtures only"
	@echo "  chmod            Make all scripts executable"
	@echo "  docs             Open documentation"
	@echo ""
	@echo -e "$(CYAN)Examples:$(NC)"
	@echo "  make install-deps"
	@echo "  make generate"
	@echo "  make PREFIX=Pay vanity"
	@echo "  make test"
	@echo ""
