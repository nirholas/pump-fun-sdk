//! Output handling for generated keypairs.
//!
//! This module handles the secure output of generated keypairs
//! in formats compatible with the Solana CLI.

use crate::security::{secure_write_file, verify_keypair_integrity, SecurityError};
use serde::{Deserialize, Serialize};
use solana_sdk::signer::keypair::Keypair;
use solana_sdk::signature::Signer;
use std::path::{Path, PathBuf};
use thiserror::Error;

/// Output-related errors
#[derive(Error, Debug)]
pub enum OutputError {
    #[error("Failed to serialize keypair: {0}")]
    SerializationError(#[from] serde_json::Error),

    #[error("Security error: {0}")]
    SecurityError(#[from] SecurityError),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Invalid keypair data")]
    InvalidKeypairData,
}

/// Result type for output operations
pub type OutputResult<T> = Result<T, OutputError>;

/// A generated vanity address with its keypair
pub struct GeneratedAddress {
    /// The keypair (contains both public and secret key)
    keypair: Keypair,
    /// Number of attempts taken to find this address
    pub attempts: u64,
    /// Time taken to find this address (in milliseconds)
    pub time_ms: u64,
}

impl GeneratedAddress {
    /// Create a new generated address
    pub fn new(keypair: Keypair, attempts: u64, time_ms: u64) -> Self {
        Self {
            keypair,
            attempts,
            time_ms,
        }
    }

    /// Get the public key as a Base58 string
    pub fn public_key(&self) -> String {
        self.keypair.pubkey().to_string()
    }

    /// Get the secret key bytes (64 bytes: 32 private + 32 public)
    ///
    /// # Security
    /// This returns sensitive data. Handle with care and zeroize after use.
    pub fn secret_key_bytes(&self) -> [u8; 64] {
        self.keypair.to_bytes()
    }

    /// Get a reference to the keypair
    pub fn keypair(&self) -> &Keypair {
        &self.keypair
    }

    /// Verify the keypair integrity
    pub fn verify(&self) -> OutputResult<()> {
        verify_keypair_integrity(&self.keypair)?;
        Ok(())
    }
}

impl std::fmt::Debug for GeneratedAddress {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // Never print secret key in debug output
        f.debug_struct("GeneratedAddress")
            .field("public_key", &self.public_key())
            .field("attempts", &self.attempts)
            .field("time_ms", &self.time_ms)
            .field("secret_key", &"[REDACTED]")
            .finish()
    }
}

/// Output format for keypair files
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutputFormat {
    /// JSON array of bytes (Solana CLI compatible)
    SolanaJson,
    /// Human-readable report
    Report,
}

/// Generate the default output path for an address
pub fn default_output_path(public_key: &str) -> PathBuf {
    PathBuf::from(format!("{public_key}.json"))
}

/// Write a keypair to a file in Solana CLI compatible JSON format
///
/// The format is a JSON array of 64 bytes representing the secret key.
/// This is the same format used by `solana-keygen`.
///
/// # Security
/// - File is written with mode 0o600 on Unix
/// - Keypair integrity is verified before writing
pub fn write_keypair_file(address: &GeneratedAddress, path: &Path) -> OutputResult<()> {
    // Verify keypair before writing
    address.verify()?;

    // Serialize to Solana CLI format (JSON array of bytes)
    let bytes = address.secret_key_bytes();
    let json = serde_json::to_string(&bytes.to_vec())?;

    // Write securely
    secure_write_file(path, json.as_bytes())?;

    log::info!("Wrote keypair to: {}", path.display());

    Ok(())
}

/// Write a human-readable report about the generated address
pub fn write_report(address: &GeneratedAddress, path: &Path) -> OutputResult<()> {
    let report = generate_report(address);
    secure_write_file(path, report.as_bytes())?;
    Ok(())
}

/// Generate a human-readable report
pub fn generate_report(address: &GeneratedAddress) -> String {
    let public_key = address.public_key();

    format!(
        r#"================================================================================
                    SOLANA VANITY ADDRESS GENERATION REPORT
================================================================================

Public Key: {public_key}

Statistics:
  - Attempts: {attempts:>15}
  - Time:     {time:>15.2} seconds
  - Rate:     {rate:>15.2} keys/second

Security Notes:
  - This keypair was generated using the official Solana SDK
  - The keypair file should have permissions 0600 (owner read/write only)
  - Store your keypair file securely and create backups
  - NEVER share your secret key with anyone

Verification:
  - To verify this keypair, run: solana-keygen verify {public_key} <keypair-file>
  - To check balance: solana balance {public_key}

================================================================================
"#,
        public_key = public_key,
        attempts = address.attempts,
        time = address.time_ms as f64 / 1000.0,
        rate = if address.time_ms > 0 {
            (address.attempts as f64) / (address.time_ms as f64 / 1000.0)
        } else {
            0.0
        },
    )
}

/// Print generation result to stdout (without secret key)
pub fn print_result(address: &GeneratedAddress, verbose: bool) {
    let public_key = address.public_key();

    if verbose {
        println!("\n✅ Found matching address!");
        println!("   Public Key: {public_key}");
        println!("   Attempts:   {}", address.attempts);
        println!(
            "   Time:       {:.2} seconds",
            address.time_ms as f64 / 1000.0
        );
        if address.time_ms > 0 {
            println!(
                "   Rate:       {:.2} keys/second",
                (address.attempts as f64) / (address.time_ms as f64 / 1000.0)
            );
        }
    } else {
        println!("{public_key}");
    }
}

/// Print a quiet result (just the public key)
pub fn print_quiet_result(address: &GeneratedAddress) {
    println!("{}", address.public_key());
}

/// Verification report for a generated keypair
#[derive(Debug, Serialize, Deserialize)]
pub struct VerificationReport {
    pub public_key: String,
    pub signature_valid: bool,
    pub keypair_format_valid: bool,
    pub file_permissions_secure: bool,
}

/// Verify a generated keypair file
pub fn verify_keypair_file(path: &Path) -> OutputResult<VerificationReport> {
    use crate::security::verify_file_permissions;

    // Read and parse the keypair file
    let content = std::fs::read_to_string(path)?;
    let bytes: Vec<u8> = serde_json::from_str(&content)?;

    if bytes.len() != 64 {
        return Err(OutputError::InvalidKeypairData);
    }

    let mut key_bytes = [0u8; 64];
    key_bytes.copy_from_slice(&bytes);

    let keypair =
        Keypair::from_bytes(&key_bytes).map_err(|_| OutputError::InvalidKeypairData)?;

    // Verify signature
    let signature_valid = verify_keypair_integrity(&keypair).is_ok();

    // Check file permissions
    let file_permissions_secure = verify_file_permissions(path).unwrap_or(false);

    Ok(VerificationReport {
        public_key: keypair.pubkey().to_string(),
        signature_valid,
        keypair_format_valid: true,
        file_permissions_secure,
    })
}

/// Print verification report
pub fn print_verification_report(report: &VerificationReport) {
    println!("\n🔍 Keypair Verification Report");
    println!("   Public Key:     {}", report.public_key);
    println!(
        "   Signature:      {}",
        if report.signature_valid { "✅ Valid" } else { "❌ Invalid" }
    );
    println!(
        "   Format:         {}",
        if report.keypair_format_valid {
            "✅ Valid"
        } else {
            "❌ Invalid"
        }
    );
    println!(
        "   Permissions:    {}",
        if report.file_permissions_secure {
            "✅ Secure"
        } else {
            "⚠️  Not secure"
        }
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_generated_address_debug() {
        let keypair = Keypair::new();
        let address = GeneratedAddress::new(keypair, 100, 1000);
        let debug_str = format!("{:?}", address);
        assert!(debug_str.contains("REDACTED"));
        assert!(!debug_str.contains(&format!("{:?}", address.secret_key_bytes())));
    }

    #[test]
    fn test_write_keypair_file() {
        let dir = tempdir().unwrap();
        let keypair = Keypair::new();
        let address = GeneratedAddress::new(keypair, 100, 1000);
        let path = dir.path().join("test.json");

        write_keypair_file(&address, &path).unwrap();

        // Read back and verify
        let content = std::fs::read_to_string(&path).unwrap();
        let bytes: Vec<u8> = serde_json::from_str(&content).unwrap();
        assert_eq!(bytes.len(), 64);
    }

    #[test]
    fn test_solana_cli_format_compatibility() {
        let dir = tempdir().unwrap();
        let keypair = Keypair::new();
        let original_pubkey = keypair.pubkey();
        let address = GeneratedAddress::new(keypair, 100, 1000);
        let path = dir.path().join("test.json");

        write_keypair_file(&address, &path).unwrap();

        // Read back like Solana CLI would
        let content = std::fs::read_to_string(&path).unwrap();
        let bytes: Vec<u8> = serde_json::from_str(&content).unwrap();

        // Reconstruct keypair
        let mut key_bytes = [0u8; 64];
        key_bytes.copy_from_slice(&bytes);
        let restored = Keypair::from_bytes(&key_bytes).unwrap();

        assert_eq!(restored.pubkey(), original_pubkey);
    }

    #[test]
    fn test_verify_keypair_file() {
        let dir = tempdir().unwrap();
        let keypair = Keypair::new();
        let address = GeneratedAddress::new(keypair, 100, 1000);
        let path = dir.path().join("test.json");

        write_keypair_file(&address, &path).unwrap();

        let report = verify_keypair_file(&path).unwrap();
        assert!(report.signature_valid);
        assert!(report.keypair_format_valid);
    }

    #[test]
    fn test_default_output_path() {
        let path = default_output_path("ABC123xyz");
        assert_eq!(path.to_string_lossy(), "ABC123xyz.json");
    }

    #[test]
    fn test_generate_report() {
        let keypair = Keypair::new();
        let address = GeneratedAddress::new(keypair, 1000, 5000);
        let report = generate_report(&address);

        assert!(report.contains(&address.public_key()));
        assert!(report.contains("1000")); // attempts
        assert!(report.contains("NEVER share"));
    }
}
