//! Pattern matching for vanity addresses.
//!
//! This module provides efficient prefix and suffix matching
//! for Solana Base58 addresses.

use crate::config::{validate_prefix, validate_suffix, ConfigError, BASE58_ALPHABET};

/// Target pattern to match against generated addresses
#[derive(Debug, Clone)]
pub enum MatchTarget {
    /// Match only the prefix of the address
    Prefix {
        pattern: String,
        case_insensitive: bool,
    },
    /// Match only the suffix of the address
    Suffix {
        pattern: String,
        case_insensitive: bool,
    },
    /// Match both prefix and suffix
    Both {
        prefix: String,
        suffix: String,
        case_insensitive: bool,
    },
}

impl MatchTarget {
    /// Create a prefix-only match target
    pub fn prefix(pattern: &str, case_insensitive: bool) -> Result<Self, ConfigError> {
        validate_prefix(pattern)?;
        Ok(Self::Prefix {
            pattern: pattern.to_string(),
            case_insensitive,
        })
    }

    /// Create a suffix-only match target
    pub fn suffix(pattern: &str, case_insensitive: bool) -> Result<Self, ConfigError> {
        validate_suffix(pattern)?;
        Ok(Self::Suffix {
            pattern: pattern.to_string(),
            case_insensitive,
        })
    }

    /// Create a match target for both prefix and suffix
    pub fn both(prefix: &str, suffix: &str, case_insensitive: bool) -> Result<Self, ConfigError> {
        validate_prefix(prefix)?;
        validate_suffix(suffix)?;
        Ok(Self::Both {
            prefix: prefix.to_string(),
            suffix: suffix.to_string(),
            case_insensitive,
        })
    }

    /// Check if the given address matches this target
    #[inline]
    pub fn matches(&self, address: &str) -> bool {
        match self {
            Self::Prefix { pattern, case_insensitive } => {
                if *case_insensitive {
                    address
                        .get(..pattern.len())
                        .map(|s| s.eq_ignore_ascii_case(pattern))
                        .unwrap_or(false)
                } else {
                    address.starts_with(pattern)
                }
            }
            Self::Suffix { pattern, case_insensitive } => {
                if *case_insensitive {
                    address
                        .get(address.len().saturating_sub(pattern.len())..)
                        .map(|s| s.eq_ignore_ascii_case(pattern))
                        .unwrap_or(false)
                } else {
                    address.ends_with(pattern)
                }
            }
            Self::Both { prefix, suffix, case_insensitive } => {
                let prefix_matches = if *case_insensitive {
                    address
                        .get(..prefix.len())
                        .map(|s| s.eq_ignore_ascii_case(prefix))
                        .unwrap_or(false)
                } else {
                    address.starts_with(prefix)
                };

                if !prefix_matches {
                    return false;
                }

                if *case_insensitive {
                    address
                        .get(address.len().saturating_sub(suffix.len())..)
                        .map(|s| s.eq_ignore_ascii_case(suffix))
                        .unwrap_or(false)
                } else {
                    address.ends_with(suffix)
                }
            }
        }
    }

    /// Get the total pattern length (for difficulty estimation)
    pub fn pattern_length(&self) -> usize {
        match self {
            Self::Prefix { pattern, .. } => pattern.len(),
            Self::Suffix { pattern, .. } => pattern.len(),
            Self::Both { prefix, suffix, .. } => prefix.len() + suffix.len(),
        }
    }

    /// Get a human-readable description of the match target
    pub fn description(&self) -> String {
        match self {
            Self::Prefix { pattern, case_insensitive } => {
                let case_str = if *case_insensitive { " (case-insensitive)" } else { "" };
                format!("prefix '{pattern}'{case_str}")
            }
            Self::Suffix { pattern, case_insensitive } => {
                let case_str = if *case_insensitive { " (case-insensitive)" } else { "" };
                format!("suffix '{pattern}'{case_str}")
            }
            Self::Both { prefix, suffix, case_insensitive } => {
                let case_str = if *case_insensitive { " (case-insensitive)" } else { "" };
                format!("prefix '{prefix}' and suffix '{suffix}'{case_str}")
            }
        }
    }

    /// Check if case-insensitive matching is enabled
    pub fn is_case_insensitive(&self) -> bool {
        match self {
            Self::Prefix { case_insensitive, .. } => *case_insensitive,
            Self::Suffix { case_insensitive, .. } => *case_insensitive,
            Self::Both { case_insensitive, .. } => *case_insensitive,
        }
    }
}

/// Optimized matcher that pre-computes values for faster matching
#[derive(Debug, Clone)]
pub struct OptimizedMatcher {
    target: MatchTarget,
    /// Pre-computed lowercase pattern for case-insensitive matching
    lowercase_prefix: Option<String>,
    lowercase_suffix: Option<String>,
}

impl OptimizedMatcher {
    /// Create a new optimized matcher
    pub fn new(target: MatchTarget) -> Self {
        let (lowercase_prefix, lowercase_suffix) = match &target {
            MatchTarget::Prefix { pattern, case_insensitive } => {
                if *case_insensitive {
                    (Some(pattern.to_lowercase()), None)
                } else {
                    (None, None)
                }
            }
            MatchTarget::Suffix { pattern, case_insensitive } => {
                if *case_insensitive {
                    (None, Some(pattern.to_lowercase()))
                } else {
                    (None, None)
                }
            }
            MatchTarget::Both { prefix, suffix, case_insensitive } => {
                if *case_insensitive {
                    (Some(prefix.to_lowercase()), Some(suffix.to_lowercase()))
                } else {
                    (None, None)
                }
            }
        };

        Self {
            target,
            lowercase_prefix,
            lowercase_suffix,
        }
    }

    /// Check if the given address matches
    #[inline]
    pub fn matches(&self, address: &str) -> bool {
        match &self.target {
            MatchTarget::Prefix { pattern, case_insensitive } => {
                if *case_insensitive {
                    if let (Some(ref lc_pattern), Some(addr_prefix)) =
                        (&self.lowercase_prefix, address.get(..pattern.len()))
                    {
                        addr_prefix.to_lowercase() == *lc_pattern
                    } else {
                        false
                    }
                } else {
                    address.starts_with(pattern)
                }
            }
            MatchTarget::Suffix { pattern, case_insensitive } => {
                if *case_insensitive {
                    if let (Some(ref lc_pattern), Some(addr_suffix)) = (
                        &self.lowercase_suffix,
                        address.get(address.len().saturating_sub(pattern.len())..),
                    ) {
                        addr_suffix.to_lowercase() == *lc_pattern
                    } else {
                        false
                    }
                } else {
                    address.ends_with(pattern)
                }
            }
            MatchTarget::Both { prefix, suffix, case_insensitive } => {
                let prefix_matches = if *case_insensitive {
                    if let (Some(ref lc_pattern), Some(addr_prefix)) =
                        (&self.lowercase_prefix, address.get(..prefix.len()))
                    {
                        addr_prefix.to_lowercase() == *lc_pattern
                    } else {
                        return false;
                    }
                } else {
                    address.starts_with(prefix)
                };

                if !prefix_matches {
                    return false;
                }

                if *case_insensitive {
                    if let (Some(ref lc_pattern), Some(addr_suffix)) = (
                        &self.lowercase_suffix,
                        address.get(address.len().saturating_sub(suffix.len())..),
                    ) {
                        addr_suffix.to_lowercase() == *lc_pattern
                    } else {
                        false
                    }
                } else {
                    address.ends_with(suffix)
                }
            }
        }
    }

    /// Get a reference to the underlying target
    pub fn target(&self) -> &MatchTarget {
        &self.target
    }
}

/// Statistics about matching attempts
#[derive(Debug, Default, Clone)]
pub struct MatchStatistics {
    /// Total number of addresses checked
    pub total_checked: u64,
    /// Number of partial prefix matches (for progress indication)
    pub partial_prefix_matches: Vec<u64>,
    /// Time spent matching (in nanoseconds)
    pub matching_time_ns: u64,
}

impl MatchStatistics {
    /// Create new empty statistics
    pub fn new() -> Self {
        Self::default()
    }

    /// Record a check
    pub fn record_check(&mut self) {
        self.total_checked += 1;
    }

    /// Get the match rate (checks per second)
    pub fn checks_per_second(&self) -> f64 {
        if self.matching_time_ns == 0 {
            0.0
        } else {
            (self.total_checked as f64) / (self.matching_time_ns as f64 / 1_000_000_000.0)
        }
    }
}

/// Validate that a character is valid in Base58
#[inline]
pub fn is_valid_base58_char(c: char) -> bool {
    BASE58_ALPHABET.contains(c)
}

/// Get a list of similar valid Base58 characters for a given invalid character
pub fn suggest_valid_chars(invalid: char) -> Vec<char> {
    match invalid {
        '0' => vec!['o', 'O', 'Q', 'D'],
        'O' => vec!['o', 'Q', 'D', '0'],
        'I' => vec!['i', '1', 'L', 'J'],
        'l' => vec!['L', '1', 'i', 'j'],
        _ => vec![],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_prefix_matching_case_sensitive() {
        let target = MatchTarget::prefix("ABC", false).unwrap();
        assert!(target.matches("ABCdefghijklmnopqrstuvwxyz123456789"));
        assert!(!target.matches("abcdefghijklmnopqrstuvwxyz123456789"));
        assert!(!target.matches("XYZdefghijklmnopqrstuvwxyz123456789"));
    }

    #[test]
    fn test_prefix_matching_case_insensitive() {
        let target = MatchTarget::prefix("ABC", true).unwrap();
        assert!(target.matches("ABCdefghijklmnopqrstuvwxyz123456789"));
        assert!(target.matches("abcdefghijklmnopqrstuvwxyz123456789"));
        assert!(target.matches("AbCdefghijklmnopqrstuvwxyz123456789"));
        assert!(!target.matches("XYZdefghijklmnopqrstuvwxyz123456789"));
    }

    #[test]
    fn test_suffix_matching_case_sensitive() {
        let target = MatchTarget::suffix("XYZ", false).unwrap();
        assert!(target.matches("123456789abcdefghijklmnopqrstuvXYZ"));
        assert!(!target.matches("123456789abcdefghijklmnopqrstuvxyz"));
    }

    #[test]
    fn test_suffix_matching_case_insensitive() {
        let target = MatchTarget::suffix("XYZ", true).unwrap();
        assert!(target.matches("123456789abcdefghijklmnopqrstuvXYZ"));
        assert!(target.matches("123456789abcdefghijklmnopqrstuvxyz"));
        assert!(target.matches("123456789abcdefghijklmnopqrstuvXyZ"));
    }

    #[test]
    fn test_both_matching() {
        let target = MatchTarget::both("ABC", "XYZ", false).unwrap();
        assert!(target.matches("ABC123456789defghijklmnopqrstuvXYZ"));
        assert!(!target.matches("ABC123456789defghijklmnopqrstuvxyz"));
        assert!(!target.matches("abc123456789defghijklmnopqrstuvXYZ"));
    }

    #[test]
    fn test_optimized_matcher() {
        let target = MatchTarget::prefix("ABC", true).unwrap();
        let matcher = OptimizedMatcher::new(target);
        assert!(matcher.matches("ABCdefghijklmnopqrstuvwxyz123456789"));
        assert!(matcher.matches("abcdefghijklmnopqrstuvwxyz123456789"));
    }

    #[test]
    fn test_pattern_length() {
        let prefix = MatchTarget::prefix("ABC", false).unwrap();
        assert_eq!(prefix.pattern_length(), 3);

        let suffix = MatchTarget::suffix("XY", false).unwrap();
        assert_eq!(suffix.pattern_length(), 2);

        let both = MatchTarget::both("AB", "XYZ", false).unwrap();
        assert_eq!(both.pattern_length(), 5);
    }

    #[test]
    fn test_is_valid_base58_char() {
        assert!(is_valid_base58_char('A'));
        assert!(is_valid_base58_char('a'));
        assert!(is_valid_base58_char('1'));
        assert!(is_valid_base58_char('9'));
        assert!(!is_valid_base58_char('0'));
        assert!(!is_valid_base58_char('O'));
        assert!(!is_valid_base58_char('I'));
        assert!(!is_valid_base58_char('l'));
    }

    #[test]
    fn test_suggest_valid_chars() {
        assert!(!suggest_valid_chars('0').is_empty());
        assert!(!suggest_valid_chars('O').is_empty());
        assert!(!suggest_valid_chars('I').is_empty());
        assert!(!suggest_valid_chars('l').is_empty());
        assert!(suggest_valid_chars('A').is_empty());
    }

    #[test]
    fn test_invalid_prefix_rejected() {
        assert!(MatchTarget::prefix("0AB", false).is_err());
        assert!(MatchTarget::prefix("OAB", false).is_err());
        assert!(MatchTarget::prefix("IAB", false).is_err());
        assert!(MatchTarget::prefix("lAB", false).is_err());
    }

    #[test]
    fn test_empty_pattern_rejected() {
        assert!(MatchTarget::prefix("", false).is_err());
        assert!(MatchTarget::suffix("", false).is_err());
    }
}
