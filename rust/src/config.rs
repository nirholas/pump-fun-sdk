//! Configuration handling for the vanity address generator.
//!
//! This module provides configuration structures and validation for the generator.

use crate::matcher::MatchTarget;
use thiserror::Error;

/// Base58 alphabet used by Solana (excludes 0, O, I, l)
pub const BASE58_ALPHABET: &str = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/// Maximum reasonable prefix length (longer would take astronomical time)
pub const MAX_PREFIX_LENGTH: usize = 8;

/// Maximum reasonable suffix length
pub const MAX_SUFFIX_LENGTH: usize = 8;

/// Default output directory for generated keypairs
pub const DEFAULT_OUTPUT_DIR: &str = ".";

/// Configuration errors
#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("Invalid Base58 character '{0}' in pattern. Valid characters: {BASE58_ALPHABET}")]
    InvalidBase58Character(char),

    #[error("Pattern is empty. Please provide at least one character.")]
    EmptyPattern,

    #[error("Prefix length {0} exceeds maximum of {MAX_PREFIX_LENGTH}. Longer prefixes would take impractical time.")]
    PrefixTooLong(usize),

    #[error("Suffix length {0} exceeds maximum of {MAX_SUFFIX_LENGTH}. Longer suffixes would take impractical time.")]
    SuffixTooLong(usize),

    #[error("Thread count must be at least 1, got {0}")]
    InvalidThreadCount(usize),

    #[error("Count must be at least 1, got {0}")]
    InvalidCount(usize),

    #[error("No pattern specified. Use --prefix and/or --suffix.")]
    NoPatternSpecified,

    #[error("Output path is not writable: {0}")]
    OutputNotWritable(String),
}

/// Configuration for the vanity address generator
#[derive(Debug, Clone)]
pub struct GeneratorConfig {
    /// Target pattern to match
    pub match_target: MatchTarget,

    /// Number of threads to use
    pub threads: usize,

    /// Number of addresses to generate
    pub count: usize,

    /// Output file path (None = auto-generate from address)
    pub output_path: Option<String>,

    /// Whether to verify the keypair after generation
    pub verify: bool,

    /// Verbose output
    pub verbose: bool,

    /// Quiet mode (minimal output)
    pub quiet: bool,

    /// Dry run mode (estimate time only)
    pub dry_run: bool,
}

impl GeneratorConfig {
    /// Create a new configuration with the given match target
    pub fn new(match_target: MatchTarget) -> Self {
        Self {
            match_target,
            threads: num_cpus::get(),
            count: 1,
            output_path: None,
            verify: false,
            verbose: false,
            quiet: false,
            dry_run: false,
        }
    }

    /// Set the number of threads
    pub fn with_threads(mut self, threads: usize) -> Result<Self, ConfigError> {
        if threads == 0 {
            return Err(ConfigError::InvalidThreadCount(threads));
        }
        self.threads = threads;
        Ok(self)
    }

    /// Set the count of addresses to generate
    pub fn with_count(mut self, count: usize) -> Result<Self, ConfigError> {
        if count == 0 {
            return Err(ConfigError::InvalidCount(count));
        }
        self.count = count;
        Ok(self)
    }

    /// Set the output path
    pub fn with_output_path(mut self, path: Option<String>) -> Self {
        self.output_path = path;
        self
    }

    /// Enable verification
    pub fn with_verify(mut self, verify: bool) -> Self {
        self.verify = verify;
        self
    }

    /// Set verbose mode
    pub fn with_verbose(mut self, verbose: bool) -> Self {
        self.verbose = verbose;
        self
    }

    /// Set quiet mode
    pub fn with_quiet(mut self, quiet: bool) -> Self {
        self.quiet = quiet;
        self
    }

    /// Set dry run mode
    pub fn with_dry_run(mut self, dry_run: bool) -> Self {
        self.dry_run = dry_run;
        self
    }

    /// Validate the configuration
    pub fn validate(&self) -> Result<(), ConfigError> {
        if self.threads == 0 {
            return Err(ConfigError::InvalidThreadCount(self.threads));
        }
        if self.count == 0 {
            return Err(ConfigError::InvalidCount(self.count));
        }
        Ok(())
    }

    /// Estimate the number of attempts needed to find a match
    ///
    /// For a prefix of length n, the probability of a random address matching is:
    /// - Case-sensitive: (1/58)^n
    /// - Case-insensitive: approximately (1/34)^n (depends on pattern)
    ///
    /// Returns the expected number of attempts (50% probability of success)
    pub fn estimate_attempts(&self) -> u64 {
        let (prefix_len, suffix_len, case_insensitive) = match &self.match_target {
            MatchTarget::Prefix { pattern, case_insensitive } => {
                (pattern.len(), 0, *case_insensitive)
            }
            MatchTarget::Suffix { pattern, case_insensitive } => {
                (0, pattern.len(), *case_insensitive)
            }
            MatchTarget::Both { prefix, suffix, case_insensitive } => {
                (prefix.len(), suffix.len(), *case_insensitive)
            }
        };

        // Base probability for each position
        let base: f64 = if case_insensitive { 34.0 } else { 58.0 };

        // Total pattern length
        let total_len = prefix_len + suffix_len;

        // Expected attempts = base^total_len * ln(2) for 50% success probability
        let expected = base.powi(total_len as i32) * 0.693;

        expected as u64
    }

    /// Estimate the time to find a match based on generation rate
    pub fn estimate_time_seconds(&self, keys_per_second: f64) -> f64 {
        let attempts = self.estimate_attempts() as f64;
        attempts / keys_per_second
    }
}

/// Validate a pattern string for Base58 compatibility
pub fn validate_pattern(pattern: &str) -> Result<(), ConfigError> {
    if pattern.is_empty() {
        return Err(ConfigError::EmptyPattern);
    }

    for c in pattern.chars() {
        if !BASE58_ALPHABET.contains(c) {
            return Err(ConfigError::InvalidBase58Character(c));
        }
    }

    Ok(())
}

/// Validate a prefix pattern
pub fn validate_prefix(prefix: &str) -> Result<(), ConfigError> {
    validate_pattern(prefix)?;

    if prefix.len() > MAX_PREFIX_LENGTH {
        return Err(ConfigError::PrefixTooLong(prefix.len()));
    }

    Ok(())
}

/// Validate a suffix pattern
pub fn validate_suffix(suffix: &str) -> Result<(), ConfigError> {
    validate_pattern(suffix)?;

    if suffix.len() > MAX_SUFFIX_LENGTH {
        return Err(ConfigError::SuffixTooLong(suffix.len()));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_pattern_valid() {
        assert!(validate_pattern("ABC").is_ok());
        assert!(validate_pattern("123").is_ok());
        assert!(validate_pattern("abc").is_ok());
        assert!(validate_pattern("A1b2").is_ok());
    }

    #[test]
    fn test_validate_pattern_invalid_chars() {
        // 0, O, I, l are not in Base58
        assert!(matches!(
            validate_pattern("0"),
            Err(ConfigError::InvalidBase58Character('0'))
        ));
        assert!(matches!(
            validate_pattern("O"),
            Err(ConfigError::InvalidBase58Character('O'))
        ));
        assert!(matches!(
            validate_pattern("I"),
            Err(ConfigError::InvalidBase58Character('I'))
        ));
        assert!(matches!(
            validate_pattern("l"),
            Err(ConfigError::InvalidBase58Character('l'))
        ));
    }

    #[test]
    fn test_validate_pattern_empty() {
        assert!(matches!(validate_pattern(""), Err(ConfigError::EmptyPattern)));
    }

    #[test]
    fn test_validate_prefix_too_long() {
        let long_prefix = "A".repeat(MAX_PREFIX_LENGTH + 1);
        assert!(matches!(
            validate_prefix(&long_prefix),
            Err(ConfigError::PrefixTooLong(_))
        ));
    }

    #[test]
    fn test_config_estimate_attempts() {
        let config = GeneratorConfig::new(MatchTarget::Prefix {
            pattern: "A".to_string(),
            case_insensitive: false,
        });
        // For 1 character, expected attempts ≈ 58 * ln(2) ≈ 40
        let attempts = config.estimate_attempts();
        assert!(attempts > 30 && attempts < 50);
    }

    #[test]
    fn test_config_validation() {
        let config = GeneratorConfig::new(MatchTarget::Prefix {
            pattern: "A".to_string(),
            case_insensitive: false,
        });
        assert!(config.validate().is_ok());
    }
}
