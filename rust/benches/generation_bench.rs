//! Benchmarks for the Solana vanity address generator.
//!
//! Run with: cargo bench

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use solana_sdk::signature::Signer;
use solana_sdk::signer::keypair::Keypair;
use solana_vanity::matcher::{MatchTarget, OptimizedMatcher};

/// Benchmark raw keypair generation speed
fn bench_keypair_generation(c: &mut Criterion) {
    let mut group = c.benchmark_group("keypair_generation");
    group.throughput(Throughput::Elements(1));

    group.bench_function("new_keypair", |b| {
        b.iter(|| {
            let keypair = Keypair::new();
            black_box(keypair)
        })
    });

    group.bench_function("keypair_with_pubkey_string", |b| {
        b.iter(|| {
            let keypair = Keypair::new();
            let pubkey = keypair.pubkey().to_string();
            black_box(pubkey)
        })
    });

    group.finish();
}

/// Benchmark prefix comparison speed
fn bench_prefix_matching(c: &mut Criterion) {
    let mut group = c.benchmark_group("prefix_matching");
    group.throughput(Throughput::Elements(1));

    // Test addresses
    let matching_addr = "ABCdefghijklmnopqrstuvwxyz123456789ABCD";
    let non_matching_addr = "XYZdefghijklmnopqrstuvwxyz123456789ABCD";

    // Case-sensitive prefix matching
    let target_cs = MatchTarget::prefix("ABC", false).unwrap();
    let matcher_cs = OptimizedMatcher::new(target_cs);

    group.bench_function("case_sensitive_match", |b| {
        b.iter(|| {
            black_box(matcher_cs.matches(black_box(matching_addr)))
        })
    });

    group.bench_function("case_sensitive_no_match", |b| {
        b.iter(|| {
            black_box(matcher_cs.matches(black_box(non_matching_addr)))
        })
    });

    // Case-insensitive prefix matching
    let target_ci = MatchTarget::prefix("abc", true).unwrap();
    let matcher_ci = OptimizedMatcher::new(target_ci);

    group.bench_function("case_insensitive_match", |b| {
        b.iter(|| {
            black_box(matcher_ci.matches(black_box(matching_addr)))
        })
    });

    group.bench_function("case_insensitive_no_match", |b| {
        b.iter(|| {
            black_box(matcher_ci.matches(black_box(non_matching_addr)))
        })
    });

    group.finish();
}

/// Benchmark suffix matching
fn bench_suffix_matching(c: &mut Criterion) {
    let mut group = c.benchmark_group("suffix_matching");
    group.throughput(Throughput::Elements(1));

    let matching_addr = "ABCdefghijklmnopqrstuvwxyz123456XYZ";
    let non_matching_addr = "ABCdefghijklmnopqrstuvwxyz123456ABC";

    let target = MatchTarget::suffix("XYZ", false).unwrap();
    let matcher = OptimizedMatcher::new(target);

    group.bench_function("suffix_match", |b| {
        b.iter(|| {
            black_box(matcher.matches(black_box(matching_addr)))
        })
    });

    group.bench_function("suffix_no_match", |b| {
        b.iter(|| {
            black_box(matcher.matches(black_box(non_matching_addr)))
        })
    });

    group.finish();
}

/// Benchmark combined prefix+suffix matching
fn bench_combined_matching(c: &mut Criterion) {
    let mut group = c.benchmark_group("combined_matching");
    group.throughput(Throughput::Elements(1));

    let full_match = "ABCdefghijklmnopqrstuvwxyz123XYZ";
    let prefix_only = "ABCdefghijklmnopqrstuvwxyz123ABC";
    let suffix_only = "XYZdefghijklmnopqrstuvwxyz123XYZ";
    let no_match = "XYZdefghijklmnopqrstuvwxyz123ABC";

    let target = MatchTarget::both("ABC", "XYZ", false).unwrap();
    let matcher = OptimizedMatcher::new(target);

    group.bench_function("both_match", |b| {
        b.iter(|| {
            black_box(matcher.matches(black_box(full_match)))
        })
    });

    group.bench_function("prefix_only_match", |b| {
        b.iter(|| {
            black_box(matcher.matches(black_box(prefix_only)))
        })
    });

    group.bench_function("suffix_only_match", |b| {
        b.iter(|| {
            black_box(matcher.matches(black_box(suffix_only)))
        })
    });

    group.bench_function("no_match", |b| {
        b.iter(|| {
            black_box(matcher.matches(black_box(no_match)))
        })
    });

    group.finish();
}

/// Benchmark different prefix lengths
fn bench_prefix_lengths(c: &mut Criterion) {
    let mut group = c.benchmark_group("prefix_lengths");
    group.throughput(Throughput::Elements(1));

    let test_addr = "ABCDEFGHijklmnopqrstuvwxyz123456789";

    for len in [1, 2, 3, 4, 5, 6] {
        let prefix: String = test_addr.chars().take(len).collect();
        let target = MatchTarget::prefix(&prefix, false).unwrap();
        let matcher = OptimizedMatcher::new(target);

        group.bench_with_input(
            BenchmarkId::new("prefix_len", len),
            &len,
            |b, _| {
                b.iter(|| {
                    black_box(matcher.matches(black_box(test_addr)))
                })
            },
        );
    }

    group.finish();
}

/// Benchmark full generation cycle (keypair + pubkey string + match check)
fn bench_full_cycle(c: &mut Criterion) {
    let mut group = c.benchmark_group("full_generation_cycle");
    group.throughput(Throughput::Elements(1));

    let target = MatchTarget::prefix("A", false).unwrap();
    let matcher = OptimizedMatcher::new(target);

    group.bench_function("generate_and_check", |b| {
        b.iter(|| {
            let keypair = Keypair::new();
            let pubkey = keypair.pubkey().to_string();
            let matches = matcher.matches(&pubkey);
            black_box((pubkey, matches))
        })
    });

    group.finish();
}

/// Benchmark signature operations (for verification overhead measurement)
fn bench_signature(c: &mut Criterion) {
    let mut group = c.benchmark_group("signature");

    let keypair = Keypair::new();
    let message = b"test message for benchmarking";

    group.bench_function("sign", |b| {
        b.iter(|| {
            black_box(keypair.sign_message(black_box(message)))
        })
    });

    let signature = keypair.sign_message(message);
    let pubkey_bytes = keypair.pubkey().to_bytes();

    group.bench_function("verify", |b| {
        b.iter(|| {
            black_box(signature.verify(black_box(&pubkey_bytes), black_box(message)))
        })
    });

    group.bench_function("sign_and_verify", |b| {
        b.iter(|| {
            let sig = keypair.sign_message(message);
            black_box(sig.verify(&pubkey_bytes, message))
        })
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_keypair_generation,
    bench_prefix_matching,
    bench_suffix_matching,
    bench_combined_matching,
    bench_prefix_lengths,
    bench_full_cycle,
    bench_signature,
);

criterion_main!(benches);
