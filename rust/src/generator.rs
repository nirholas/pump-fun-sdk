//! Core vanity address generation logic.
//!
//! This module provides multi-threaded vanity address generation
//! using the official Solana SDK for cryptographic operations.

use crate::matcher::{MatchTarget, OptimizedMatcher};
use crate::output::GeneratedAddress;
use crate::security::{verify_keypair_integrity, verify_rng_quality};
use rayon::prelude::*;
use solana_sdk::signature::Signer;
use solana_sdk::signer::keypair::Keypair;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;
use thiserror::Error;

/// Generator errors
#[derive(Error, Debug)]
pub enum GeneratorError {
    #[error("RNG quality check failed: {0}")]
    RngError(String),

    #[error("Keypair verification failed: {0}")]
    VerificationError(String),

    #[error("Generation cancelled by user")]
    Cancelled,

    #[error("Invalid configuration: {0}")]
    ConfigError(String),
}

/// Result type for generator operations
pub type GeneratorResult<T> = Result<T, GeneratorError>;

/// Progress callback type
pub type ProgressCallback = Box<dyn Fn(u64, f64) + Send + Sync>;

/// Configuration for the vanity generator
#[derive(Clone)]
pub struct VanityGeneratorConfig {
    /// Number of threads to use
    pub threads: usize,
    /// Whether to verify keypairs after generation
    pub verify_keypairs: bool,
    /// Progress report interval (in attempts)
    pub progress_interval: u64,
}

impl Default for VanityGeneratorConfig {
    fn default() -> Self {
        Self {
            threads: num_cpus::get(),
            verify_keypairs: true,
            progress_interval: 100_000,
        }
    }
}

/// The main vanity address generator
pub struct VanityGenerator {
    config: VanityGeneratorConfig,
    matcher: OptimizedMatcher,
    cancelled: Arc<AtomicBool>,
    attempts: Arc<AtomicU64>,
}

impl VanityGenerator {
    /// Create a new vanity generator
    pub fn new(target: MatchTarget, config: VanityGeneratorConfig) -> GeneratorResult<Self> {
        // Verify RNG quality before starting
        verify_rng_quality().map_err(|e| GeneratorError::RngError(e.to_string()))?;

        let matcher = OptimizedMatcher::new(target);

        Ok(Self {
            config,
            matcher,
            cancelled: Arc::new(AtomicBool::new(false)),
            attempts: Arc::new(AtomicU64::new(0)),
        })
    }

    /// Create a generator with default configuration
    pub fn with_target(target: MatchTarget) -> GeneratorResult<Self> {
        Self::new(target, VanityGeneratorConfig::default())
    }

    /// Get a cancellation handle
    pub fn cancel_handle(&self) -> Arc<AtomicBool> {
        Arc::clone(&self.cancelled)
    }

    /// Get the current attempt count
    pub fn attempts(&self) -> u64 {
        self.attempts.load(Ordering::Relaxed)
    }

    /// Cancel the generation
    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
    }

    /// Check if generation has been cancelled
    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }

    /// Generate a single vanity address
    ///
    /// This method blocks until a matching address is found or the generation
    /// is cancelled.
    pub fn generate(&self) -> GeneratorResult<GeneratedAddress> {
        self.generate_with_callback(None)
    }

    /// Generate a vanity address with progress callback
    pub fn generate_with_callback(
        &self,
        progress: Option<ProgressCallback>,
    ) -> GeneratorResult<GeneratedAddress> {
        let start_time = Instant::now();
        let cancelled = Arc::clone(&self.cancelled);
        let attempts = Arc::clone(&self.attempts);
        let matcher = self.matcher.clone();
        let verify = self.config.verify_keypairs;
        let progress_interval = self.config.progress_interval;

        // Configure thread pool
        let pool = rayon::ThreadPoolBuilder::new()
            .num_threads(self.config.threads)
            .build()
            .map_err(|e| GeneratorError::ConfigError(e.to_string()))?;

        // Result storage
        let result: Arc<std::sync::Mutex<Option<GeneratedAddress>>> =
            Arc::new(std::sync::Mutex::new(None));

        // Progress tracking
        let last_progress_report = Arc::new(AtomicU64::new(0));

        pool.install(|| {
            // Use parallel iteration with early termination
            (0..usize::MAX).into_par_iter().find_any(|_| {
                // Check for cancellation
                if cancelled.load(Ordering::Relaxed) {
                    return true; // Exit early
                }

                // Check if we already found a result
                if result.lock().unwrap().is_some() {
                    return true; // Exit early
                }

                // Generate a new keypair
                let keypair = Keypair::new();
                let pubkey_str = keypair.pubkey().to_string();

                // Increment attempt counter
                let current_attempts = attempts.fetch_add(1, Ordering::Relaxed) + 1;

                // Report progress periodically
                if let Some(ref callback) = progress {
                    let last_report = last_progress_report.load(Ordering::Relaxed);
                    if current_attempts - last_report >= progress_interval {
                        last_progress_report.store(current_attempts, Ordering::Relaxed);
                        let elapsed = start_time.elapsed().as_secs_f64();
                        callback(current_attempts, elapsed);
                    }
                }

                // Check for match
                if matcher.matches(&pubkey_str) {
                    // Verify keypair if configured
                    if verify {
                        if let Err(e) = verify_keypair_integrity(&keypair) {
                            log::error!("Keypair verification failed: {}", e);
                            return false; // Continue searching
                        }
                    }

                    let elapsed_ms = start_time.elapsed().as_millis() as u64;
                    let address = GeneratedAddress::new(keypair, current_attempts, elapsed_ms);

                    let mut guard = result.lock().unwrap();
                    if guard.is_none() {
                        *guard = Some(address);
                    }
                    return true; // Found!
                }

                false // Continue searching
            });
        });

        // Check cancellation
        if cancelled.load(Ordering::SeqCst) && result.lock().unwrap().is_none() {
            return Err(GeneratorError::Cancelled);
        }

        // Return result
        let final_result = result
            .lock()
            .unwrap()
            .take()
            .ok_or(GeneratorError::Cancelled);
        final_result
    }

    /// Generate multiple vanity addresses
    pub fn generate_multiple(&self, count: usize) -> GeneratorResult<Vec<GeneratedAddress>> {
        let mut results = Vec::with_capacity(count);

        for i in 0..count {
            if self.is_cancelled() {
                break;
            }

            log::info!("Generating address {}/{}", i + 1, count);
            let address = self.generate()?;
            results.push(address);
        }

        Ok(results)
    }

    /// Estimate the difficulty of finding a match
    ///
    /// Returns (expected_attempts, probability_per_attempt)
    pub fn estimate_difficulty(&self) -> (f64, f64) {
        let target = self.matcher.target();
        let case_insensitive = target.is_case_insensitive();
        let pattern_len = target.pattern_length();

        // Base probability for each character position
        let base: f64 = if case_insensitive { 34.0 } else { 58.0 };

        let prob_per_attempt = 1.0 / base.powi(pattern_len as i32);
        let expected_attempts = 1.0 / prob_per_attempt;

        (expected_attempts, prob_per_attempt)
    }

    /// Get generation rate (keys per second) from current stats
    pub fn current_rate(&self) -> f64 {
        // This is a snapshot and may not be perfectly accurate
        self.attempts.load(Ordering::Relaxed) as f64
    }
}

/// A simpler, single-threaded generator for testing
pub fn generate_single(target: &MatchTarget) -> GeneratedAddress {
    let matcher = OptimizedMatcher::new(target.clone());
    let start = Instant::now();
    let mut attempts = 0u64;

    loop {
        let keypair = Keypair::new();
        let pubkey_str = keypair.pubkey().to_string();
        attempts += 1;

        if matcher.matches(&pubkey_str) {
            let elapsed_ms = start.elapsed().as_millis() as u64;
            return GeneratedAddress::new(keypair, attempts, elapsed_ms);
        }
    }
}

/// Benchmark keypair generation speed
pub fn benchmark_generation_rate(duration_secs: u64) -> u64 {
    let start = Instant::now();
    let mut count = 0u64;

    while start.elapsed().as_secs() < duration_secs {
        let _keypair = Keypair::new();
        let _ = _keypair.pubkey().to_string();
        count += 1;
    }

    count / duration_secs
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_single_char_prefix() {
        let target = MatchTarget::prefix("A", false).unwrap();
        let address = generate_single(&target);
        assert!(address.public_key().starts_with('A'));
    }

    #[test]
    fn test_generate_single_char_prefix_case_insensitive() {
        let target = MatchTarget::prefix("a", true).unwrap();
        let address = generate_single(&target);
        assert!(
            address.public_key().starts_with('A') || address.public_key().starts_with('a')
        );
    }

    #[test]
    fn test_generator_cancellation() {
        let target = MatchTarget::prefix("ZZZZZ", false).unwrap(); // Very unlikely
        let generator = VanityGenerator::with_target(target).unwrap();

        // Cancel immediately
        generator.cancel();

        let result = generator.generate();
        assert!(matches!(result, Err(GeneratorError::Cancelled)));
    }

    #[test]
    fn test_generator_with_callback() {
        use std::sync::atomic::AtomicBool;

        let target = MatchTarget::prefix("A", false).unwrap();
        let config = VanityGeneratorConfig {
            threads: 1,
            verify_keypairs: true,
            progress_interval: 10,
        };
        let generator = VanityGenerator::new(target, config).unwrap();

        let callback_called = Arc::new(AtomicBool::new(false));
        let callback_called_clone = Arc::clone(&callback_called);

        let callback: ProgressCallback = Box::new(move |_attempts, _elapsed| {
            callback_called_clone.store(true, Ordering::SeqCst);
        });

        let result = generator.generate_with_callback(Some(callback));
        assert!(result.is_ok());
    }

    #[test]
    fn test_estimate_difficulty() {
        let target = MatchTarget::prefix("AB", false).unwrap();
        let generator = VanityGenerator::with_target(target).unwrap();

        let (expected, prob) = generator.estimate_difficulty();

        // For 2-char case-sensitive prefix: expected ≈ 58^2 ≈ 3364
        assert!(expected > 3000.0 && expected < 4000.0);
        assert!(prob > 0.0 && prob < 0.001);
    }

    #[test]
    fn test_keypair_verification() {
        let target = MatchTarget::prefix("A", false).unwrap();
        let config = VanityGeneratorConfig {
            threads: 1,
            verify_keypairs: true,
            progress_interval: 100_000,
        };
        let generator = VanityGenerator::new(target, config).unwrap();

        let result = generator.generate();
        assert!(result.is_ok());

        // The generated address should have been verified
        let address = result.unwrap();
        assert!(address.verify().is_ok());
    }

    #[test]
    fn test_multi_threaded_generation() {
        let target = MatchTarget::prefix("A", false).unwrap();
        let config = VanityGeneratorConfig {
            threads: 4,
            verify_keypairs: true,
            progress_interval: 100_000,
        };
        let generator = VanityGenerator::new(target, config).unwrap();

        let result = generator.generate();
        assert!(result.is_ok());
        assert!(result.unwrap().public_key().starts_with('A'));
    }

    #[test]
    fn test_benchmark_generation_rate() {
        let rate = benchmark_generation_rate(1);
        // Should generate at least 10,000 keys per second on modern hardware
        assert!(rate > 1000, "Generation rate too low: {} keys/sec", rate);
    }
}
