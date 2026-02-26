#!/usr/bin/env node
/**
 * @fileoverview CLI entry point for the Solana vanity address generator.
 * Uses only @solana/web3.js for cryptographic operations.
 * @module index
 */

import { VanityGenerator } from './lib/generator';
import { saveKeypair, generateSummary } from './lib/output';
import { validateVanityInput, estimateAttempts, formatTimeEstimate } from './lib/validation';
import { getSecurityWarnings, performSecurityChecks } from './lib/security';
import { VanityError, VanityErrorType } from './lib/types';
import { formatNumber, formatDuration, formatRate } from './utils/format';
import { BASE58_ALPHABET } from './utils/base58';

/**
 * Command-line options interface.
 */
interface CommandOptions {
  prefix?: string;
  suffix?: string;
  ignoreCase: boolean;
  output?: string;
  maxAttempts?: number;
  verbose: boolean;
  verify: boolean;
  overwrite: boolean;
  securityCheck: boolean;
  help: boolean;
  version: boolean;
  info: boolean;
  validate?: string;
}

const VERSION = '0.1.0';

/**
 * Parses command line arguments using Node's built-in process.argv.
 */
function parseArgs(): CommandOptions {
  const args = process.argv.slice(2);
  const options: CommandOptions = {
    ignoreCase: false,
    verbose: false,
    verify: true,
    overwrite: false,
    securityCheck: false,
    help: false,
    version: false,
    info: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '-p':
      case '--prefix':
        options.prefix = nextArg;
        i++;
        break;
      case '-s':
      case '--suffix':
        options.suffix = nextArg;
        i++;
        break;
      case '-i':
      case '--ignore-case':
        options.ignoreCase = true;
        break;
      case '-o':
      case '--output':
        options.output = nextArg;
        i++;
        break;
      case '-m':
      case '--max-attempts':
        options.maxAttempts = parseInt(nextArg, 10);
        i++;
        break;
      case '-v':
      case '--verbose':
        options.verbose = true;
        break;
      case '--no-verify':
        options.verify = false;
        break;
      case '--overwrite':
        options.overwrite = true;
        break;
      case '--security-check':
        options.securityCheck = true;
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '--version':
        options.version = true;
        break;
      case 'info':
        options.info = true;
        break;
      case 'validate':
        options.validate = nextArg;
        i++;
        break;
    }
  }

  return options;
}

/**
 * Displays help information.
 */
function displayHelp(): void {
  console.log(`
Solana Vanity Address Generator v${VERSION}

Generate Solana vanity addresses with custom prefixes and suffixes.

USAGE:
  solana-vanity-ts [OPTIONS]
  solana-vanity-ts info
  solana-vanity-ts validate <pattern>

OPTIONS:
  -p, --prefix <prefix>     Address prefix to search for (Base58 characters only)
  -s, --suffix <suffix>     Address suffix to search for (Base58 characters only)
  -i, --ignore-case         Case-insensitive matching
  -o, --output <file>       Output file path (default: <address>.json)
  -m, --max-attempts <num>  Maximum attempts before giving up
  -v, --verbose             Show detailed progress information
  --no-verify               Skip file verification after writing
  --overwrite               Overwrite existing output file
  --security-check          Run security checks before generation
  -h, --help                Display this help message
  --version                 Display version information

EXAMPLES:
  solana-vanity-ts --prefix ABC
  solana-vanity-ts --prefix AB --suffix 99 --ignore-case
  solana-vanity-ts --prefix ABC --output my-key.json
  solana-vanity-ts info
  solana-vanity-ts validate ABC

SECURITY NOTE:
  The generated keypair file contains your PRIVATE KEY.
  Keep it secure and never share it with anyone.
`);
}

/**
 * Displays general information about vanity address generation.
 */
function displayInfo(): void {
  console.log('\nVanity Address Generation Information');
  console.log('=====================================\n');

  console.log('What is a vanity address?');
  console.log('  A vanity address is a cryptocurrency address that contains a');
  console.log('  custom pattern (like your name or a word) in the address itself.\n');

  console.log('Base58 Character Set:');
  console.log(`  ${BASE58_ALPHABET}\n`);
  console.log('  Excluded: 0 (zero), O (uppercase o), I (uppercase i), l (lowercase L)\n');

  console.log('Difficulty Estimates:');
  const estimates = [
    { chars: 1, attempts: 58 },
    { chars: 2, attempts: 3364 },
    { chars: 3, attempts: 195112 },
    { chars: 4, attempts: 11316496 },
    { chars: 5, attempts: 656356768 },
    { chars: 6, attempts: 38068692544 },
  ];

  for (const { chars, attempts } of estimates) {
    const time = formatTimeEstimate(attempts, 15000);
    console.log(`  ${chars} character(s): ~${formatNumber(attempts)} attempts (${time})`);
  }

  console.log('\nPerformance Note:');
  console.log('  TypeScript/JavaScript implementation: ~15,000-20,000 attempts/sec');
  console.log('  For faster generation, consider using the Rust CLI implementation.\n');

  console.log('Security Reminders:');
  console.log('  - Never share your keypair file with anyone');
  console.log('  - Store backups in secure locations');
  console.log('  - The keypair file contains your PRIVATE KEY\n');
}

/**
 * Validates a pattern and displays the result.
 */
function validatePattern(pattern: string): void {
  console.log(`\nValidating pattern: "${pattern}"\n`);

  try {
    validateVanityInput(pattern, undefined);
    console.log('Pattern is valid!\n');

    // Show difficulty
    const attempts = estimateAttempts(pattern);
    console.log('Difficulty:');
    console.log(`  Expected attempts: ~${formatNumber(attempts)}`);
    console.log(`  Estimated time: ${formatTimeEstimate(attempts, 15000)}\n`);
  } catch (error) {
    if (error instanceof VanityError) {
      console.log(`Pattern is invalid:\n  ${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Runs security checks and displays the results.
 */
function runSecurityChecks(): void {
  console.log('Security Checks:');

  const checks = performSecurityChecks();

  for (const check of checks) {
    const icon = check.passed ? '[PASS]' : '[WARN]';
    console.log(`  ${icon} ${check.check}`);
    console.log(`      ${check.message}`);
  }

  console.log('');
}

/**
 * Main generator function.
 */
async function runGenerator(options: CommandOptions): Promise<void> {
  // Display header
  console.log('\nSolana Vanity Address Generator');
  console.log('===============================\n');

  // Run security checks if requested
  if (options.securityCheck) {
    runSecurityChecks();
  }

  // Display security warnings
  const warnings = getSecurityWarnings();
  for (const warning of warnings) {
    console.log(`Warning: ${warning}\n`);
  }

  // Validate inputs
  const prefix = options.prefix?.trim();
  const suffix = options.suffix?.trim();

  if ((prefix === undefined || prefix === '') && (suffix === undefined || suffix === '')) {
    console.log('Error: At least one of --prefix or --suffix must be specified.');
    console.log('\nUse --help for usage information.');
    process.exit(1);
  }

  try {
    validateVanityInput(prefix, suffix);
  } catch (error) {
    if (error instanceof VanityError) {
      console.log(`Validation Error: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  // Display search parameters
  console.log('Search Parameters:');
  if (prefix !== undefined && prefix !== '') {
    console.log(`  Prefix: ${prefix}`);
  }
  if (suffix !== undefined && suffix !== '') {
    console.log(`  Suffix: ${suffix}`);
  }
  console.log(`  Case-insensitive: ${options.ignoreCase ? 'yes' : 'no'}`);

  // Calculate and display difficulty estimate
  const estimated = estimateAttempts(prefix, suffix, options.ignoreCase);
  console.log(`  Expected attempts: ~${formatNumber(estimated)}`);
  console.log(`  Estimated time: ${formatTimeEstimate(estimated, 15000)}`);
  console.log('');

  console.log('Generating vanity address...');

  let lastUpdate = Date.now();

  // Build generator options, only including defined values
  const generatorOptions: {
    prefix?: string;
    suffix?: string;
    ignoreCase?: boolean;
    maxAttempts?: number;
    onProgress?: (attempts: number, rate: number) => void;
  } = {
    ignoreCase: options.ignoreCase,
    onProgress: (attempts, rate) => {
      const now = Date.now();

      // Update every 1 second or when verbose
      if (options.verbose || now - lastUpdate >= 1000) {
        const progress = Math.min(attempts / estimated, 1);
        const progressPercent = (progress * 100).toFixed(1);

        process.stderr.write(
          `\rSearching... ${formatNumber(attempts)} attempts | ${formatRate(rate)} | ~${progressPercent}% of expected    `
        );

        lastUpdate = now;
      }
    },
  };

  if (prefix !== undefined && prefix !== '') {
    generatorOptions.prefix = prefix;
  }
  if (suffix !== undefined && suffix !== '') {
    generatorOptions.suffix = suffix;
  }
  if (options.maxAttempts !== undefined) {
    generatorOptions.maxAttempts = options.maxAttempts;
  }

  // Create generator
  const generator = new VanityGenerator(generatorOptions);

  // Generate the address
  const result = await generator.generate();

  // Clear progress line
  process.stderr.write('\r' + ' '.repeat(80) + '\r');

  console.log('Found matching address!\n');

  // Display result
  console.log('Result:');
  console.log(`  Address: ${result.publicKey}`);
  console.log(`  Attempts: ${formatNumber(result.attempts)}`);
  console.log(`  Duration: ${formatDuration(result.duration)}`);
  console.log('');

  // Determine output path
  const outputPath = options.output ?? `${result.publicKey}.json`;

  // Save keypair
  console.log('Saving keypair...');

  try {
    await saveKeypair(result.secretKey, outputPath, {
      verify: options.verify,
      overwrite: options.overwrite,
    });
    console.log(`Keypair saved to: ${outputPath}`);
  } catch (error) {
    console.log('Failed to save keypair');
    throw error;
  }

  // Display summary
  console.log('');
  console.log(generateSummary(result.publicKey, outputPath));
}

/**
 * Handles errors and displays appropriate messages.
 */
function handleError(error: unknown): void {
  if (error instanceof VanityError) {
    switch (error.type) {
      case VanityErrorType.MAX_ATTEMPTS_REACHED:
        console.log('\nMaximum attempts reached');
        console.log(`   ${error.message}\n`);
        break;

      case VanityErrorType.INVALID_CHARACTERS:
        console.log('\nInvalid characters in pattern');
        console.log(`   ${error.message}\n`);
        break;

      case VanityErrorType.FILE_EXISTS:
        console.log('\nFile already exists');
        console.log(`   ${error.message}\n`);
        break;

      case VanityErrorType.FILE_ERROR:
        console.log('\nFile error');
        console.log(`   ${error.message}\n`);
        break;

      case VanityErrorType.VERIFICATION_FAILED:
        console.log('\nFile verification failed');
        console.log(`   ${error.message}\n`);
        break;

      default:
        console.log(`\nError: ${error.message}\n`);
    }
  } else if (error instanceof Error) {
    console.log(`\nUnexpected error: ${error.message}\n`);
    if (process.env['DEBUG'] !== undefined) {
      console.error(error.stack);
    }
  } else {
    console.log(`\nUnknown error: ${String(error)}\n`);
  }
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const options = parseArgs();

  if (options.version) {
    console.log(`solana-vanity-ts v${VERSION}`);
    process.exit(0);
  }

  if (options.help) {
    displayHelp();
    process.exit(0);
  }

  if (options.info) {
    displayInfo();
    process.exit(0);
  }

  if (options.validate !== undefined) {
    validatePattern(options.validate);
    process.exit(0);
  }

  try {
    await runGenerator(options);
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
}

// Run main
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
