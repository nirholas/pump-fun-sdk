//! Solana Vanity Address Generator Library
//!
//! A high-performance, secure vanity address generator for Solana.
//!
//! This library provides functionality to generate Solana keypairs
//! whose public addresses match specified patterns (prefixes, suffixes, or both).
//!
//! # Features
//!
//! - Multi-threaded generation using rayon
//! - Secure memory handling with zeroization
//! - Output format compatible with Solana CLI
//! - Comprehensive input validation
//!
//! # Example
//!
//! ```rust,no_run
//! use solana_vanity::{VanityGenerator, MatchTarget, VanityGeneratorConfig};
//!
//! // Generate an address starting with "ABC"
//! let target = MatchTarget::prefix("ABC", false).unwrap();
//! let generator = VanityGenerator::with_target(target).unwrap();
//!
//! let address = generator.generate().unwrap();
//! println!("Found: {}", address.public_key());
//! ```
//!
//! # Security
//!
//! This library uses the official Solana SDK for all cryptographic operations.
//! Secret keys are handled securely and zeroized when dropped.
//! Generated keypair files are written with restricted permissions (0600 on Unix).

pub mod config;
pub mod generator;
pub mod matcher;
pub mod output;
pub mod security;

// Re-export main types for convenience
pub use config::{ConfigError, GeneratorConfig, BASE58_ALPHABET};
pub use generator::{GeneratorError, VanityGenerator, VanityGeneratorConfig};
pub use matcher::{is_valid_base58_char, MatchTarget, OptimizedMatcher};
pub use output::{
    default_output_path, print_result, write_keypair_file, write_report, GeneratedAddress,
    OutputError, OutputFormat, VerificationReport,
};
pub use security::{
    secure_write_file, verify_keypair_integrity, verify_rng_quality, SecureBytes, SecurityError,
};

/// Library version
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Convenience function to generate a vanity address with a prefix
///
/// # Arguments
/// * `prefix` - The prefix to match (case-sensitive)
/// * `threads` - Number of threads (0 = auto-detect)
///
/// # Returns
/// The generated address, or an error
///
/// # Example
/// ```rust,no_run
/// use solana_vanity::generate_with_prefix;
///
/// let address = generate_with_prefix("AB", 0).unwrap();
/// println!("Found: {}", address.public_key());
/// ```
pub fn generate_with_prefix(
    prefix: &str,
    threads: usize,
) -> Result<GeneratedAddress, GeneratorError> {
    let target = MatchTarget::prefix(prefix, false)
        .map_err(|e| GeneratorError::ConfigError(e.to_string()))?;

    let config = VanityGeneratorConfig {
        threads: if threads == 0 { num_cpus::get() } else { threads },
        ..Default::default()
    };

    let generator = VanityGenerator::new(target, config)?;
    generator.generate()
}

/// Convenience function to generate a vanity address with a suffix
///
/// # Arguments
/// * `suffix` - The suffix to match (case-sensitive)
/// * `threads` - Number of threads (0 = auto-detect)
///
/// # Returns
/// The generated address, or an error
pub fn generate_with_suffix(
    suffix: &str,
    threads: usize,
) -> Result<GeneratedAddress, GeneratorError> {
    let target = MatchTarget::suffix(suffix, false)
        .map_err(|e| GeneratorError::ConfigError(e.to_string()))?;

    let config = VanityGeneratorConfig {
        threads: if threads == 0 { num_cpus::get() } else { threads },
        ..Default::default()
    };

    let generator = VanityGenerator::new(target, config)?;
    generator.generate()
}

/// Validate a pattern for use as a prefix or suffix
///
/// Returns Ok(()) if the pattern is valid, or an error describing the problem.
pub fn validate_pattern(pattern: &str) -> Result<(), ConfigError> {
    config::validate_pattern(pattern)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_with_prefix() {
        let result = generate_with_prefix("A", 1);
        assert!(result.is_ok());
        assert!(result.unwrap().public_key().starts_with('A'));
    }

    #[test]
    fn test_generate_with_suffix() {
        let result = generate_with_suffix("1", 1);
        assert!(result.is_ok());
        assert!(result.unwrap().public_key().ends_with('1'));
    }

    #[test]
    fn test_validate_pattern() {
        assert!(validate_pattern("ABC").is_ok());
        assert!(validate_pattern("0").is_err()); // Invalid Base58
        assert!(validate_pattern("").is_err()); // Empty
    }

    #[test]
    fn test_library_version() {
        assert!(!VERSION.is_empty());
    }
}
