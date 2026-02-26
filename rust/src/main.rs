//! Solana Vanity Address Generator CLI
//!
//! A command-line tool for generating Solana vanity addresses.
//! Uses only official Solana SDK dependencies.

use clap::Parser;
use solana_vanity::{
    config::{validate_prefix, validate_suffix},
    generator::{benchmark_generation_rate, VanityGenerator, VanityGeneratorConfig},
    matcher::MatchTarget,
    output::{
        default_output_path, print_quiet_result, print_result, print_verification_report,
        verify_keypair_file, write_keypair_file, write_report,
    },
    security::warn_if_elevated,
};
use std::path::PathBuf;
use std::process;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use thiserror::Error;

/// CLI Error type
#[derive(Error, Debug)]
pub enum CliError {
    #[error("Invalid argument: {0}")]
    InvalidArgument(String),
    #[error("Generation error: {0}")]
    GenerationError(#[from] solana_vanity::GeneratorError),
    #[error("Output error: {0}")]
    OutputError(#[from] solana_vanity::output::OutputError),
    #[error("Config error: {0}")]
    ConfigError(String),
}

type Result<T> = std::result::Result<T, CliError>;

/// Solana Vanity Address Generator
///
/// Generate Solana keypairs with custom address patterns.
/// Uses the official Solana SDK for secure key generation.
#[derive(Parser, Debug)]
#[command(name = "solana-vanity")]
#[command(author, version, about, long_about = None)]
#[command(after_help = "EXAMPLES:
    solana-vanity --prefix ABC
    solana-vanity --prefix AB --suffix 99 --ignore-case
    solana-vanity --prefix ABC --threads 8 --output my-key.json
    solana-vanity --prefix AB --count 3
    solana-vanity --dry-run --prefix ABCD")]
struct Cli {
    /// Find address starting with PREFIX
    #[arg(short, long, value_name = "PREFIX")]
    prefix: Option<String>,

    /// Find address ending with SUFFIX
    #[arg(short, long, value_name = "SUFFIX")]
    suffix: Option<String>,

    /// Case-insensitive matching
    #[arg(short, long)]
    ignore_case: bool,

    /// Number of threads (default: all CPUs)
    #[arg(short, long, value_name = "NUM")]
    threads: Option<usize>,

    /// Output file (default: <ADDRESS>.json)
    #[arg(short, long, value_name = "FILE")]
    output: Option<PathBuf>,

    /// Number of addresses to generate (default: 1)
    #[arg(short, long, value_name = "NUM", default_value = "1")]
    count: usize,

    /// Verbose output
    #[arg(short, long)]
    verbose: bool,

    /// Minimal output (just the public key)
    #[arg(short, long, conflicts_with = "verbose")]
    quiet: bool,

    /// Verify output after generation
    #[arg(long)]
    verify: bool,

    /// Estimate time without generating
    #[arg(long)]
    dry_run: bool,

    /// Generate a report file alongside the keypair
    #[arg(long)]
    report: bool,

    /// Overwrite existing output files without prompting
    #[arg(long)]
    overwrite: bool,
}

fn main() {
    if let Err(e) = run() {
        eprintln!("Error: {}", e);
        process::exit(1);
    }
}

fn run() -> Result<()> {
    // Parse CLI arguments
    let cli = Cli::parse();

    // Warn if running as root
    warn_if_elevated();

    // Validate arguments
    if cli.prefix.is_none() && cli.suffix.is_none() {
        return Err(CliError::InvalidArgument(
            "No pattern specified. Use --prefix and/or --suffix to specify a pattern.".to_string()
        ));
    }

    // Validate prefix
    if let Some(ref prefix) = cli.prefix {
        validate_prefix(prefix).map_err(|e| CliError::ConfigError(format!("Invalid prefix: {}", e)))?;
    }

    // Validate suffix
    if let Some(ref suffix) = cli.suffix {
        validate_suffix(suffix).map_err(|e| CliError::ConfigError(format!("Invalid suffix: {}", e)))?;
    }

    // Validate count
    if cli.count == 0 {
        return Err(CliError::InvalidArgument("Count must be at least 1".to_string()));
    }

    // Create match target
    let target = create_match_target(&cli)?;

    // Handle dry run
    if cli.dry_run {
        return dry_run(&target, cli.threads.unwrap_or_else(num_cpus::get));
    }

    // Run generation
    generate_addresses(&cli, target)
}

fn create_match_target(cli: &Cli) -> Result<MatchTarget> {
    match (&cli.prefix, &cli.suffix) {
        (Some(prefix), Some(suffix)) => {
            MatchTarget::both(prefix, suffix, cli.ignore_case)
                .map_err(|e| CliError::ConfigError(format!("Invalid pattern: {}", e)))
        }
        (Some(prefix), None) => {
            MatchTarget::prefix(prefix, cli.ignore_case)
                .map_err(|e| CliError::ConfigError(format!("Invalid prefix: {}", e)))
        }
        (None, Some(suffix)) => {
            MatchTarget::suffix(suffix, cli.ignore_case)
                .map_err(|e| CliError::ConfigError(format!("Invalid suffix: {}", e)))
        }
        (None, None) => unreachable!(), // Already validated above
    }
}

fn dry_run(target: &MatchTarget, threads: usize) -> Result<()> {
    println!();
    println!("Difficulty Estimation");
    println!("=====================");
    println!("Pattern:    {}", target.description());
    println!("Threads:    {threads}");

    // Benchmark generation rate (single-threaded measurement)
    println!();
    println!("Benchmarking generation rate (1 second)...");
    let rate_per_thread = benchmark_generation_rate(1);
    let total_rate = rate_per_thread * threads as u64;

    println!("Rate:       {} keys/second (single thread)", format_number(rate_per_thread));
    println!("Total Rate: ~{} keys/second (estimated with {} threads)", format_number(total_rate), threads);

    // Calculate expected attempts
    let generator = VanityGenerator::with_target(target.clone())?;
    let (expected_attempts, _prob) = generator.estimate_difficulty();

    println!();
    println!("Expected Attempts: {}", format_number(expected_attempts as u64));

    // Estimate time
    let expected_seconds = expected_attempts / total_rate as f64;
    println!("Estimated Time:    {}", format_duration(expected_seconds));

    // Show probability table
    println!();
    println!("Probability of finding within:");
    for &multiplier in &[0.5, 1.0, 2.0, 5.0] {
        let time = expected_seconds * multiplier;
        let probability = 1.0 - (-multiplier).exp();
        println!(
            "  {} -> {:.1}% chance",
            format_duration(time),
            probability * 100.0
        );
    }

    println!();

    Ok(())
}

fn generate_addresses(cli: &Cli, target: MatchTarget) -> Result<()> {
    let threads = cli.threads.unwrap_or_else(num_cpus::get);

    // Print header
    if !cli.quiet {
        println!();
        println!("Solana Vanity Address Generator");
        println!("===============================");
        println!("Pattern:  {}", target.description());
        println!("Threads:  {threads}");
        println!("Count:    {}", cli.count);
        println!();
    }

    // Create generator config
    let config = VanityGeneratorConfig {
        threads,
        verify_keypairs: true,
        progress_interval: 50_000,
    };

    // Setup cancellation flag with proper Ctrl+C handling
    let cancelled = Arc::new(AtomicBool::new(false));
    let cancelled_handler = Arc::clone(&cancelled);
    ctrlc::set_handler(move || {
        cancelled_handler.store(true, Ordering::SeqCst);
        eprintln!("\nReceived Ctrl+C, cancelling...");
    }).expect("Error setting Ctrl+C handler");

    // Generate addresses
    for i in 0..cli.count {
        if cancelled.load(Ordering::SeqCst) {
            println!("\nGeneration cancelled.");
            break;
        }

        if cli.count > 1 && !cli.quiet {
            println!("Generating address {}/{}", i + 1, cli.count);
        }

        let result = generate_single_address(&cli, &config, target.clone(), &cancelled)?;

        if let Some(address) = result {
            // Determine output path
            // When generating multiple addresses with explicit --output, append index to avoid overwriting
            let output_path = if cli.count > 1 && cli.output.is_some() {
                let base = cli.output.as_ref().unwrap();
                let stem = base.file_stem().unwrap_or_default().to_string_lossy();
                let ext = base.extension().map(|e| e.to_string_lossy()).unwrap_or_default();
                if ext.is_empty() {
                    base.with_file_name(format!("{}-{}", stem, i + 1))
                } else {
                    base.with_file_name(format!("{}-{}.{}", stem, i + 1, ext))
                }
            } else {
                cli.output
                    .clone()
                    .unwrap_or_else(|| default_output_path(&address.public_key()))
            };

            // Check if file exists and --overwrite not set
            if output_path.exists() && !cli.overwrite {
                return Err(CliError::InvalidArgument(format!(
                    "Output file '{}' already exists. Use --overwrite to replace.",
                    output_path.display()
                )));
            }

            // Write keypair file
            write_keypair_file(&address, &output_path)?;

            // Write report if requested
            if cli.report {
                let report_path = output_path.with_extension("txt");
                write_report(&address, &report_path)?;
            }

            // Print result
            if cli.quiet {
                print_quiet_result(&address);
            } else {
                print_result(&address, cli.verbose);
                println!("Saved to: {}", output_path.display());
            }

            // Verify if requested
            if cli.verify {
                let report = verify_keypair_file(&output_path)?;
                print_verification_report(&report);
            }

            if !cli.quiet {
                println!();
            }
        }
    }

    Ok(())
}

fn generate_single_address(
    cli: &Cli,
    config: &VanityGeneratorConfig,
    target: MatchTarget,
    cancelled: &Arc<AtomicBool>,
) -> Result<Option<solana_vanity::GeneratedAddress>> {
    // Check if already cancelled
    if cancelled.load(Ordering::SeqCst) {
        return Ok(None);
    }

    let generator = VanityGenerator::new(target, config.clone())?;

    // Link the global cancellation flag to the generator's cancel handle
    let gen_cancelled = generator.cancel_handle();
    let cancelled_clone = Arc::clone(cancelled);

    // Spawn a lightweight watcher that propagates cancellation from Ctrl+C
    let gen_cancelled_clone = Arc::clone(&gen_cancelled);
    let watcher = std::thread::spawn(move || {
        while !cancelled_clone.load(Ordering::Relaxed) {
            if gen_cancelled_clone.load(Ordering::Relaxed) {
                // Generator finished on its own
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
        // Propagate cancellation to generator
        gen_cancelled_clone.store(true, Ordering::SeqCst);
    });

    // Track progress with simple output
    let start = Instant::now();
    let last_print = Arc::new(std::sync::Mutex::new(Instant::now()));
    let quiet = cli.quiet;

    // Create progress callback
    let callback: solana_vanity::generator::ProgressCallback =
        Box::new(move |attempts, elapsed| {
            if quiet {
                return;
            }
            // Use try_lock to avoid panic if mutex is poisoned
            if let Ok(mut last) = last_print.try_lock() {
                if last.elapsed().as_secs() >= 1 {
                    let rate = if elapsed > 0.0 {
                        attempts as f64 / elapsed
                    } else {
                        0.0
                    };
                    eprint!(
                        "\rSearching... {} attempts ({:.0} keys/sec)    ",
                        format_number(attempts),
                        rate
                    );
                    *last = Instant::now();
                }
            }
        });

    // Generate
    let result = generator.generate_with_callback(Some(callback));

    // Signal the watcher to stop (generator finished) and wait for it
    gen_cancelled.store(true, Ordering::SeqCst);
    let _ = watcher.join();

    // Clear progress line
    if !cli.quiet {
        let elapsed = start.elapsed();
        eprint!("\r{:60}\r", ""); // Clear the line
        if elapsed.as_secs() >= 1 {
            println!("Search completed in {}", format_duration(elapsed.as_secs_f64()));
        }
    }

    match result {
        Ok(address) => Ok(Some(address)),
        Err(solana_vanity::GeneratorError::Cancelled) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

fn format_number(n: u64) -> String {
    let s = n.to_string();
    let mut result = String::new();
    for (i, c) in s.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 {
            result.insert(0, ',');
        }
        result.insert(0, c);
    }
    result
}

fn format_duration(seconds: f64) -> String {
    if seconds < 1.0 {
        format!("{:.0}ms", seconds * 1000.0)
    } else if seconds < 60.0 {
        format!("{:.1}s", seconds)
    } else if seconds < 3600.0 {
        let minutes = seconds / 60.0;
        format!("{:.1} minutes", minutes)
    } else if seconds < 86400.0 {
        let hours = seconds / 3600.0;
        format!("{:.1} hours", hours)
    } else if seconds < 31536000.0 {
        let days = seconds / 86400.0;
        format!("{:.1} days", days)
    } else {
        let years = seconds / 31536000.0;
        format!("{:.1} years", years)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_number() {
        assert_eq!(format_number(123), "123");
        assert_eq!(format_number(1234), "1,234");
        assert_eq!(format_number(1234567), "1,234,567");
    }

    #[test]
    fn test_format_duration() {
        assert!(format_duration(0.5).contains("ms"));
        assert!(format_duration(30.0).contains("s"));
        assert!(format_duration(120.0).contains("minutes"));
        assert!(format_duration(7200.0).contains("hours"));
        assert!(format_duration(172800.0).contains("days"));
    }

    #[test]
    fn test_cli_parsing() {
        let cli = Cli::parse_from(["solana-vanity", "--prefix", "ABC"]);
        assert_eq!(cli.prefix, Some("ABC".to_string()));
        assert!(cli.suffix.is_none());
        assert!(!cli.ignore_case);
    }

    #[test]
    fn test_cli_with_suffix() {
        let cli = Cli::parse_from(["solana-vanity", "--suffix", "XYZ", "--ignore-case"]);
        assert!(cli.prefix.is_none());
        assert_eq!(cli.suffix, Some("XYZ".to_string()));
        assert!(cli.ignore_case);
    }

    #[test]
    fn test_cli_with_threads() {
        let cli = Cli::parse_from(["solana-vanity", "--prefix", "A", "--threads", "4"]);
        assert_eq!(cli.threads, Some(4));
    }
}
