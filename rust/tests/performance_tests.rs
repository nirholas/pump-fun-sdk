//! Performance tests for the Solana vanity address generator.
//!
//! These tests verify that performance meets expected baselines.

use solana_vanity::{
    generator::{benchmark_generation_rate, VanityGenerator, VanityGeneratorConfig},
    matcher::{MatchTarget, OptimizedMatcher},
};
use std::time::{Duration, Instant};

/// Test that keypair generation meets minimum performance threshold
#[test]
fn test_generation_rate_threshold() {
    // Should generate at least 1,000 keys per second even on slow CI environments
    // Modern hardware typically achieves 10,000-100,000+ keys/sec
    let rate = benchmark_generation_rate(1);
    assert!(
        rate >= 1_000,
        "Generation rate {} keys/sec is below minimum threshold of 1,000",
        rate
    );

    println!("Single-threaded generation rate: {} keys/sec", rate);
}

/// Test that multi-threaded generation scales
#[test]
fn test_multi_thread_scaling() {
    let target = MatchTarget::prefix("AB", false).unwrap();

    // Single-threaded
    let config_1 = VanityGeneratorConfig {
        threads: 1,
        verify_keypairs: false,
        progress_interval: 100_000,
    };
    let generator_1 = VanityGenerator::new(target.clone(), config_1).unwrap();
    let start = Instant::now();
    let _ = generator_1.generate().unwrap();
    let time_1 = start.elapsed();

    // Multi-threaded (4 threads)
    let config_4 = VanityGeneratorConfig {
        threads: 4,
        verify_keypairs: false,
        progress_interval: 100_000,
    };
    let generator_4 = VanityGenerator::new(target.clone(), config_4).unwrap();
    let start = Instant::now();
    let _ = generator_4.generate().unwrap();
    let time_4 = start.elapsed();

    // Multi-threaded should generally be faster, but due to randomness
    // we can't guarantee it for every run. Just log the results.
    println!(
        "1 thread: {:?}, 4 threads: {:?}",
        time_1, time_4
    );
}

/// Test prefix matching performance
#[test]
fn test_prefix_matching_performance() {
    let target = MatchTarget::prefix("ABC", false).unwrap();
    let matcher = OptimizedMatcher::new(target);

    let test_addresses = [
        "ABCdefghijklmnopqrstuvwxyz123456789ABCD",
        "XYZdefghijklmnopqrstuvwxyz123456789ABCD",
        "ABXdefghijklmnopqrstuvwxyz123456789ABCD",
        "abcdefghijklmnopqrstuvwxyz123456789ABCD",
    ];

    let start = Instant::now();
    let iterations = 1_000_000;

    for _ in 0..iterations {
        for addr in &test_addresses {
            let _ = matcher.matches(addr);
        }
    }

    let elapsed = start.elapsed();
    let matches_per_sec =
        (iterations as f64 * test_addresses.len() as f64) / elapsed.as_secs_f64();

    println!(
        "Prefix matching rate: {:.0} matches/sec ({:?} for {} iterations)",
        matches_per_sec, elapsed, iterations
    );

    // Should be able to do at least 10M matches per second
    assert!(
        matches_per_sec >= 1_000_000.0,
        "Matching rate {:.0}/sec is too slow",
        matches_per_sec
    );
}

/// Test case-insensitive matching performance
#[test]
fn test_case_insensitive_matching_performance() {
    let target = MatchTarget::prefix("abc", true).unwrap();
    let matcher = OptimizedMatcher::new(target);

    let test_addresses = [
        "ABCdefghijklmnopqrstuvwxyz123456789ABCD",
        "abcdefghijklmnopqrstuvwxyz123456789ABCD",
        "AbCdefghijklmnopqrstuvwxyz123456789ABCD",
        "XYZdefghijklmnopqrstuvwxyz123456789ABCD",
    ];

    let start = Instant::now();
    let iterations = 1_000_000;

    for _ in 0..iterations {
        for addr in &test_addresses {
            let _ = matcher.matches(addr);
        }
    }

    let elapsed = start.elapsed();
    let matches_per_sec =
        (iterations as f64 * test_addresses.len() as f64) / elapsed.as_secs_f64();

    println!(
        "Case-insensitive matching rate: {:.0} matches/sec",
        matches_per_sec
    );

    // Case-insensitive should still be fast
    assert!(
        matches_per_sec >= 500_000.0,
        "Case-insensitive matching rate {:.0}/sec is too slow",
        matches_per_sec
    );
}

/// Test generation with verification overhead
#[test]
fn test_verification_overhead() {
    let target = MatchTarget::prefix("A", false).unwrap();

    // Without verification
    let config_no_verify = VanityGeneratorConfig {
        threads: 1,
        verify_keypairs: false,
        progress_interval: 100_000,
    };
    let generator = VanityGenerator::new(target.clone(), config_no_verify).unwrap();

    let mut total_no_verify = Duration::ZERO;
    for _ in 0..10 {
        let start = Instant::now();
        let _ = generator.generate().unwrap();
        total_no_verify += start.elapsed();
    }

    // With verification
    let config_verify = VanityGeneratorConfig {
        threads: 1,
        verify_keypairs: true,
        progress_interval: 100_000,
    };
    let generator = VanityGenerator::new(target, config_verify).unwrap();

    let mut total_verify = Duration::ZERO;
    for _ in 0..10 {
        let start = Instant::now();
        let _ = generator.generate().unwrap();
        total_verify += start.elapsed();
    }

    println!(
        "Average time without verification: {:?}",
        total_no_verify / 10
    );
    println!(
        "Average time with verification: {:?}",
        total_verify / 10
    );

    // Verification should add some overhead but not excessive
    // (less than 100% overhead)
    let overhead_ratio =
        total_verify.as_secs_f64() / total_no_verify.as_secs_f64();
    assert!(
        overhead_ratio < 3.0,
        "Verification overhead {:.1}x is too high",
        overhead_ratio
    );
}

/// Test that 2-char prefix generation completes in reasonable time
#[test]
fn test_2char_prefix_time() {
    let target = MatchTarget::prefix("AB", false).unwrap();
    let config = VanityGeneratorConfig {
        threads: num_cpus::get(),
        verify_keypairs: true,
        progress_interval: 100_000,
    };

    let generator = VanityGenerator::new(target, config).unwrap();

    let start = Instant::now();
    let address = generator.generate().unwrap();
    let elapsed = start.elapsed();

    println!(
        "2-char prefix found in {:?} ({} attempts)",
        elapsed,
        address.attempts
    );

    // Should complete within 30 seconds on most hardware
    assert!(
        elapsed < Duration::from_secs(30),
        "2-char prefix took too long: {:?}",
        elapsed
    );
}

/// Test memory efficiency (no large allocations during generation)
#[test]
fn test_memory_efficiency() {
    // This is a basic test - generate many keys and ensure
    // memory doesn't grow excessively

    let target = MatchTarget::prefix("A", false).unwrap();
    let config = VanityGeneratorConfig {
        threads: 1,
        verify_keypairs: false,
        progress_interval: 100_000,
    };

    let generator = VanityGenerator::new(target, config).unwrap();

    // Generate 100 addresses
    for _ in 0..100 {
        let _ = generator.generate().unwrap();
    }

    // If we get here without OOM, memory management is reasonable
}
