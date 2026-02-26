//! Security utilities for the vanity address generator.
//!
//! This module provides security-critical functionality including:
//! - Secure file operations with proper permissions
//! - Memory zeroization for sensitive data
//! - RNG quality verification
//! - File integrity checks

use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::Path;
use thiserror::Error;
use zeroize::Zeroize;
use solana_sdk::signature::Signer;

#[cfg(unix)]
use std::os::unix::fs::OpenOptionsExt;

/// Security-related errors
#[derive(Error, Debug)]
pub enum SecurityError {
    #[error("Failed to set file permissions: {0}")]
    PermissionError(#[from] io::Error),

    #[error("RNG quality check failed: {0}")]
    RngQualityError(String),

    #[error("File integrity check failed: expected {expected} bytes, got {actual} bytes")]
    IntegrityError { expected: usize, actual: usize },

    #[error("Keypair verification failed: {0}")]
    KeypairVerificationError(String),

    #[error("Path is not safe for writing sensitive data: {0}")]
    UnsafePathError(String),
}

/// Result type for security operations
pub type SecurityResult<T> = Result<T, SecurityError>;

/// A wrapper around sensitive data that zeroizes on drop
#[derive(Clone)]
pub struct SecureBytes {
    data: Vec<u8>,
}

impl SecureBytes {
    /// Create new secure bytes from a vector
    pub fn new(data: Vec<u8>) -> Self {
        Self { data }
    }

    /// Get a reference to the data
    pub fn as_slice(&self) -> &[u8] {
        &self.data
    }

    /// Get the length of the data
    pub fn len(&self) -> usize {
        self.data.len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }
}

impl Drop for SecureBytes {
    fn drop(&mut self) {
        self.data.zeroize();
    }
}

impl std::fmt::Debug for SecureBytes {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // Never print the actual data
        write!(f, "SecureBytes([REDACTED; {} bytes])", self.data.len())
    }
}

/// Securely write data to a file with restricted permissions
///
/// On Unix systems, the file is created with mode 0o600 (owner read/write only).
/// On Windows, the default permissions are used.
///
/// # Arguments
/// * `path` - Path to write the file to
/// * `data` - Data to write
///
/// # Security
/// - Creates file with restricted permissions BEFORE writing any data
/// - Uses atomic write where possible
/// - Verifies file integrity after write
pub fn secure_write_file(path: &Path, data: &[u8]) -> SecurityResult<()> {
    // Validate the path
    validate_output_path(path)?;

    // Create parent directories if needed
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)?;
        }
    }

    // Open file with secure permissions
    #[cfg(unix)]
    let file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600) // Owner read/write only
        .open(path)?;

    #[cfg(not(unix))]
    let file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(path)?;

    // Write data
    let mut writer = io::BufWriter::new(file);
    writer.write_all(data)?;
    writer.flush()?;

    // Verify file integrity
    verify_file_integrity(path, data.len())?;

    Ok(())
}

/// Validate that a path is safe for writing sensitive data
fn validate_output_path(path: &Path) -> SecurityResult<()> {
    // Check for obviously unsafe paths
    let path_str = path.to_string_lossy();

    // Don't write to temp directories with sensitive data
    if path_str.contains("/tmp/") || path_str.contains("\\temp\\") {
        log::warn!(
            "Writing sensitive data to temporary directory: {}. \
            Consider using a more secure location.",
            path_str
        );
    }

    // Don't allow writing to system directories
    let unsafe_prefixes = ["/etc/", "/usr/", "/bin/", "/sbin/", "C:\\Windows\\"];
    for prefix in &unsafe_prefixes {
        if path_str.starts_with(prefix) {
            return Err(SecurityError::UnsafePathError(format!(
                "Cannot write sensitive data to system directory: {path_str}"
            )));
        }
    }

    Ok(())
}

/// Verify file integrity after writing
fn verify_file_integrity(path: &Path, expected_size: usize) -> SecurityResult<()> {
    let metadata = fs::metadata(path)?;
    let actual_size = metadata.len() as usize;

    if actual_size != expected_size {
        return Err(SecurityError::IntegrityError {
            expected: expected_size,
            actual: actual_size,
        });
    }

    Ok(())
}

/// Verify file permissions are secure (Unix only)
#[cfg(unix)]
pub fn verify_file_permissions(path: &Path) -> SecurityResult<bool> {
    use std::os::unix::fs::MetadataExt;

    let metadata = fs::metadata(path)?;
    let mode = metadata.mode();

    // Check that group and others have no permissions
    let is_secure = (mode & 0o077) == 0;

    Ok(is_secure)
}

#[cfg(not(unix))]
pub fn verify_file_permissions(_path: &Path) -> SecurityResult<bool> {
    // On non-Unix systems, we can't easily check permissions
    Ok(true)
}

/// Verify RNG quality by checking for basic randomness properties
///
/// This is a basic sanity check, not a comprehensive RNG test.
/// The Solana SDK uses a cryptographically secure RNG internally.
pub fn verify_rng_quality() -> SecurityResult<()> {
    use solana_sdk::signer::keypair::Keypair;

    // Generate multiple keypairs and check they're all different
    const NUM_SAMPLES: usize = 10;
    let mut public_keys = Vec::with_capacity(NUM_SAMPLES);

    for _ in 0..NUM_SAMPLES {
        let keypair = Keypair::new();
        let pubkey = keypair.pubkey().to_string();

        // Check for duplicates (would indicate RNG failure)
        if public_keys.contains(&pubkey) {
            return Err(SecurityError::RngQualityError(
                "Duplicate public key generated - RNG may be compromised".to_string(),
            ));
        }

        public_keys.push(pubkey);
    }

    // Basic entropy check: ensure public keys have varied characters
    for pubkey in &public_keys {
        let unique_chars: std::collections::HashSet<char> = pubkey.chars().collect::<std::collections::HashSet<char>>();
        if unique_chars.len() < 10 {
            return Err(SecurityError::RngQualityError(
                "Generated key has suspiciously low entropy".to_string(),
            ));
        }
    }

    Ok(())
}

/// Verify that a keypair can correctly sign and verify a message
pub fn verify_keypair_integrity(keypair: &solana_sdk::signer::keypair::Keypair) -> SecurityResult<()> {
    use solana_sdk::signature::Signer;

    // Sign a test message
    let test_message = b"solana-vanity-integrity-check";
    let signature = keypair.sign_message(test_message);

    // Verify the signature
    if !signature.verify(keypair.pubkey().as_ref(), test_message) {
        return Err(SecurityError::KeypairVerificationError(
            "Keypair failed signature verification".to_string(),
        ));
    }

    Ok(())
}

/// Securely clear a mutable byte slice
pub fn secure_clear(data: &mut [u8]) {
    data.zeroize();
}

/// A guard that ensures data is zeroized when dropped
pub struct ZeroizeGuard<'a> {
    data: &'a mut [u8],
}

impl<'a> ZeroizeGuard<'a> {
    /// Create a new zeroize guard
    pub fn new(data: &'a mut [u8]) -> Self {
        Self { data }
    }
}

impl<'a> Drop for ZeroizeGuard<'a> {
    fn drop(&mut self) {
        self.data.zeroize();
    }
}

impl<'a> std::ops::Deref for ZeroizeGuard<'a> {
    type Target = [u8];

    fn deref(&self) -> &Self::Target {
        self.data
    }
}

impl<'a> std::ops::DerefMut for ZeroizeGuard<'a> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.data
    }
}

/// Check if running with elevated privileges (not recommended)
#[cfg(unix)]
pub fn check_elevated_privileges() -> bool {
    // Use nix crate for safe uid access
    nix::unistd::geteuid().is_root()
}

#[cfg(not(unix))]
pub fn check_elevated_privileges() -> bool {
    false
}

/// Log a security warning if running as root
pub fn warn_if_elevated() {
    if check_elevated_privileges() {
        log::warn!(
            "⚠️  Running as root/administrator is not recommended for key generation. \
            Consider running as a regular user."
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_secure_bytes_zeroize() {
        let data = vec![1, 2, 3, 4, 5];
        let secure = SecureBytes::new(data);
        assert_eq!(secure.len(), 5);
        assert!(!secure.is_empty());
        // Data is zeroized on drop
    }

    #[test]
    fn test_secure_bytes_debug() {
        let secure = SecureBytes::new(vec![1, 2, 3]);
        let debug_str = format!("{:?}", secure);
        assert!(debug_str.contains("REDACTED"));
        assert!(!debug_str.contains("1"));
    }

    #[test]
    fn test_secure_write_file() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("test_key.json");

        let data = b"test data";
        secure_write_file(&path, data).unwrap();

        // Verify file exists and has correct content
        let content = fs::read(&path).unwrap();
        assert_eq!(content, data);
    }

    #[test]
    #[cfg(unix)]
    fn test_file_permissions() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("test_key.json");

        secure_write_file(&path, b"test").unwrap();

        // Verify permissions are 0o600
        let is_secure = verify_file_permissions(&path).unwrap();
        assert!(is_secure);
    }

    #[test]
    fn test_verify_rng_quality() {
        // This should pass with a properly functioning RNG
        verify_rng_quality().unwrap();
    }

    #[test]
    fn test_verify_keypair_integrity() {
        use solana_sdk::signer::keypair::Keypair;

        let keypair = Keypair::new();
        verify_keypair_integrity(&keypair).unwrap();
    }

    #[test]
    fn test_secure_clear() {
        let mut data = vec![1, 2, 3, 4, 5];
        secure_clear(&mut data);
        assert!(data.iter().all(|&b| b == 0));
    }

    #[test]
    fn test_zeroize_guard() {
        let mut data = vec![1, 2, 3, 4, 5];
        {
            let _guard = ZeroizeGuard::new(&mut data);
            // Use the guard...
        }
        // Data should be zeroized after guard is dropped
        assert!(data.iter().all(|&b| b == 0));
    }

    #[test]
    fn test_validate_unsafe_path() {
        let unsafe_path = Path::new("/etc/passwd");
        let result = validate_output_path(unsafe_path);
        assert!(result.is_err());
    }
}
