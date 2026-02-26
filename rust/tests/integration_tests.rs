//! Integration tests for the Solana vanity address generator.
//!
//! These tests verify end-to-end functionality including:
//! - Address generation with various patterns
//! - Output file format compatibility
//! - CLI argument handling

use solana_vanity::{
    generator::{VanityGenerator, VanityGeneratorConfig},
    matcher::MatchTarget,
    output::{verify_keypair_file, write_keypair_file, GeneratedAddress},
    security::verify_file_permissions,
};
use solana_sdk::signature::Signer;
use solana_sdk::signer::keypair::Keypair;
use std::fs;
use tempfile::tempdir;

/// Test that 2-character prefix generation works correctly
#[test]
fn test_prefix_generation_2_char() {
    // Run 10 iterations to ensure consistency
    for i in 0..10 {
        let target = MatchTarget::prefix("AB", false).unwrap();
        let config = VanityGeneratorConfig {
            threads: 2,
            verify_keypairs: true,
            progress_interval: 100_000,
        };

        let generator = VanityGenerator::new(target, config).unwrap();
        let result = generator.generate();

        assert!(result.is_ok(), "Iteration {}: Generation failed: {:?}", i, result.err());
        let address = result.unwrap();
        assert!(
            address.public_key().starts_with("AB"),
            "Iteration {}: Address {} doesn't start with 'AB'",
            i,
            address.public_key()
        );
    }
}

/// Test single character prefix (fast, for quick validation)
#[test]
fn test_prefix_generation_1_char() {
    for i in 0..10 {
        let target = MatchTarget::prefix("A", false).unwrap();
        let generator = VanityGenerator::with_target(target).unwrap();
        let result = generator.generate();

        assert!(result.is_ok(), "Iteration {}: Generation failed", i);
        let address = result.unwrap();
        assert!(
            address.public_key().starts_with('A'),
            "Iteration {}: Address {} doesn't start with 'A'",
            i,
            address.public_key()
        );
    }
}

/// Test case-insensitive matching
#[test]
fn test_case_insensitive_matching() {
    for i in 0..10 {
        let target = MatchTarget::prefix("ab", true).unwrap();
        let config = VanityGeneratorConfig {
            threads: 2,
            verify_keypairs: true,
            progress_interval: 100_000,
        };

        let generator = VanityGenerator::new(target, config).unwrap();
        let result = generator.generate();

        assert!(result.is_ok(), "Iteration {}: Generation failed", i);
        let address = result.unwrap();
        let pubkey = address.public_key();
        let prefix = &pubkey[..2].to_lowercase();
        assert_eq!(
            prefix, "ab",
            "Iteration {}: Address {} doesn't have correct prefix (case-insensitive)",
            i, pubkey
        );
    }
}

/// Test suffix matching
#[test]
fn test_suffix_generation() {
    for i in 0..10 {
        let target = MatchTarget::suffix("9", false).unwrap();
        let generator = VanityGenerator::with_target(target).unwrap();
        let result = generator.generate();

        assert!(result.is_ok(), "Iteration {}: Generation failed", i);
        let address = result.unwrap();
        assert!(
            address.public_key().ends_with('9'),
            "Iteration {}: Address {} doesn't end with '9'",
            i,
            address.public_key()
        );
    }
}

/// Test combined prefix and suffix matching
#[test]
fn test_prefix_and_suffix_generation() {
    for i in 0..5 {
        let target = MatchTarget::both("A", "1", false).unwrap();
        let config = VanityGeneratorConfig {
            threads: 4,
            verify_keypairs: true,
            progress_interval: 100_000,
        };

        let generator = VanityGenerator::new(target, config).unwrap();
        let result = generator.generate();

        assert!(result.is_ok(), "Iteration {}: Generation failed", i);
        let address = result.unwrap();
        let pubkey = address.public_key();
        assert!(
            pubkey.starts_with('A') && pubkey.ends_with('1'),
            "Iteration {}: Address {} doesn't match prefix 'A' and suffix '1'",
            i,
            pubkey
        );
    }
}

/// Test that generated keypair can sign and verify
#[test]
fn test_keypair_validity() {
    for i in 0..10 {
        let target = MatchTarget::prefix("A", false).unwrap();
        let generator = VanityGenerator::with_target(target).unwrap();
        let address = generator.generate().unwrap();

        // Get the keypair
        let keypair = address.keypair();

        // Sign a test message
        let message = b"test message for signature verification";
        let signature = keypair.sign_message(message);

        // Verify the signature
        assert!(
            signature.verify(keypair.pubkey().as_ref(), message),
            "Iteration {}: Signature verification failed",
            i
        );
    }
}

/// Test that output file format matches Solana CLI format
#[test]
fn test_output_file_format() {
    let dir = tempdir().unwrap();

    for i in 0..10 {
        let keypair = Keypair::new();
        let original_pubkey = keypair.pubkey();
        let address = GeneratedAddress::new(keypair, 100, 1000);
        let path = dir.path().join(format!("test_{}.json", i));

        // Write the keypair
        write_keypair_file(&address, &path).unwrap();

        // Read and parse like Solana CLI would
        let content = fs::read_to_string(&path).unwrap();
        let bytes: Vec<u8> = serde_json::from_str(&content)
            .expect("Failed to parse as JSON array");

        // Verify format
        assert_eq!(bytes.len(), 64, "Keypair should be 64 bytes");

        // Reconstruct and verify
        let mut key_bytes = [0u8; 64];
        key_bytes.copy_from_slice(&bytes);
        let restored = Keypair::from_bytes(&key_bytes)
            .expect("Failed to restore keypair");

        assert_eq!(
            restored.pubkey(),
            original_pubkey,
            "Iteration {}: Restored keypair doesn't match original",
            i
        );
    }
}

/// Test file permissions on Unix systems
#[test]
#[cfg(unix)]
fn test_file_permissions() {
    let dir = tempdir().unwrap();

    for i in 0..10 {
        let keypair = Keypair::new();
        let address = GeneratedAddress::new(keypair, 100, 1000);
        let path = dir.path().join(format!("test_{}.json", i));

        write_keypair_file(&address, &path).unwrap();

        // Verify permissions are secure (0600)
        let is_secure = verify_file_permissions(&path).unwrap();
        assert!(
            is_secure,
            "Iteration {}: File permissions are not secure",
            i
        );

        // Also check with std::fs
        use std::os::unix::fs::MetadataExt;
        let metadata = fs::metadata(&path).unwrap();
        let mode = metadata.mode() & 0o777;
        assert_eq!(
            mode, 0o600,
            "Iteration {}: Expected mode 0600, got {:o}",
            i, mode
        );
    }
}

/// Test verification report generation
#[test]
fn test_verification_report() {
    let dir = tempdir().unwrap();

    for i in 0..10 {
        let keypair = Keypair::new();
        let expected_pubkey = keypair.pubkey().to_string();
        let address = GeneratedAddress::new(keypair, 100, 1000);
        let path = dir.path().join(format!("test_{}.json", i));

        write_keypair_file(&address, &path).unwrap();

        // Verify the file
        let report = verify_keypair_file(&path).unwrap();

        assert_eq!(
            report.public_key, expected_pubkey,
            "Iteration {}: Public key mismatch in verification",
            i
        );
        assert!(
            report.signature_valid,
            "Iteration {}: Signature should be valid",
            i
        );
        assert!(
            report.keypair_format_valid,
            "Iteration {}: Format should be valid",
            i
        );
    }
}

/// Test that multiple addresses are all unique
#[test]
fn test_uniqueness_of_generated_addresses() {
    let target = MatchTarget::prefix("A", false).unwrap();
    let generator = VanityGenerator::with_target(target).unwrap();

    let mut pubkeys = std::collections::HashSet::new();

    for i in 0..10 {
        let address = generator.generate().unwrap();
        let pubkey = address.public_key();

        assert!(
            pubkeys.insert(pubkey.clone()),
            "Iteration {}: Duplicate public key generated: {}",
            i,
            pubkey
        );
    }
}

/// Test thread scaling (verify it works with different thread counts)
#[test]
fn test_thread_scaling() {
    for threads in [1, 2, 4] {
        let target = MatchTarget::prefix("A", false).unwrap();
        let config = VanityGeneratorConfig {
            threads,
            verify_keypairs: true,
            progress_interval: 100_000,
        };

        let generator = VanityGenerator::new(target, config).unwrap();
        let result = generator.generate();

        assert!(
            result.is_ok(),
            "Generation failed with {} threads",
            threads
        );
        assert!(
            result.unwrap().public_key().starts_with('A'),
            "Wrong prefix with {} threads",
            threads
        );
    }
}

/// Test that difficulty estimation is reasonable
#[test]
fn test_difficulty_estimation() {
    // 1-char prefix should take ~40 attempts on average
    let target = MatchTarget::prefix("A", false).unwrap();
    let generator = VanityGenerator::with_target(target).unwrap();
    let (expected, prob) = generator.estimate_difficulty();

    // Expected attempts for 1-char should be around 58 * ln(2) ≈ 40
    assert!(
        expected > 30.0 && expected < 100.0,
        "1-char prefix difficulty estimate {} seems wrong",
        expected
    );
    assert!(
        prob > 0.01 && prob < 0.05,
        "1-char probability {} seems wrong",
        prob
    );

    // 2-char prefix should take ~2300 attempts on average
    let target2 = MatchTarget::prefix("AB", false).unwrap();
    let generator2 = VanityGenerator::with_target(target2).unwrap();
    let (expected2, prob2) = generator2.estimate_difficulty();

    assert!(
        expected2 > 2000.0 && expected2 < 5000.0,
        "2-char prefix difficulty estimate {} seems wrong",
        expected2
    );
    assert!(
        prob2 < prob,
        "2-char probability should be lower than 1-char"
    );
}

/// Test that generation stats are accurate
#[test]
fn test_generation_stats() {
    let target = MatchTarget::prefix("A", false).unwrap();
    let generator = VanityGenerator::with_target(target).unwrap();
    let address = generator.generate().unwrap();

    // Attempts should be at least 1
    assert!(address.attempts >= 1, "Attempts should be at least 1");

    // Time should be reasonable (less than 60 seconds for a 1-char prefix)
    assert!(
        address.time_ms < 60_000,
        "Generation took too long: {} ms",
        address.time_ms
    );
}

/// Test loading a keypair file created by this tool with solana_sdk
#[test]
fn test_solana_sdk_compatibility() {
    let dir = tempdir().unwrap();

    for _ in 0..10 {
        // Generate a vanity address
        let target = MatchTarget::prefix("A", false).unwrap();
        let generator = VanityGenerator::with_target(target).unwrap();
        let address = generator.generate().unwrap();
        let original_pubkey = address.public_key();

        // Save it
        let path = dir.path().join(format!("{}.json", original_pubkey));
        write_keypair_file(&address, &path).unwrap();

        // Load it using the same method Solana CLI uses
        let content = fs::read_to_string(&path).unwrap();
        let bytes: Vec<u8> = serde_json::from_str(&content).unwrap();
        let mut key_bytes = [0u8; 64];
        key_bytes.copy_from_slice(&bytes);

        // Create keypair from bytes
        let loaded = Keypair::from_bytes(&key_bytes).unwrap();

        // Verify it matches
        assert_eq!(loaded.pubkey().to_string(), original_pubkey);

        // Verify it can sign
        let msg = b"test";
        let sig = loaded.sign_message(msg);
        assert!(sig.verify(loaded.pubkey().as_ref(), msg));
    }
}
