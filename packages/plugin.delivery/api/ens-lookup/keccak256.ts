/**
 * Pure-JS Keccak-256 implementation for Vercel Edge Runtime.
 * Keccak-256 (NOT NIST SHA3-256 — different padding).
 * Used for ENS namehash computation.
 */

// Precomputed 64-bit round constants for Keccak-f[1600]
const RC64: bigint[] = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808An, 0x8000000080008000n,
  0x000000000000808Bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008An, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000An,
  0x000000008000808Bn, 0x800000000000008Bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800An, 0x800000008000000An,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];

const MASK64 = (1n << 64n) - 1n;

// ρ rotation offsets indexed by linear position (x + 5y)
const RHO = [
   0,  1, 62, 28, 27,
  36, 44,  6, 55, 20,
   3, 10, 43, 25, 39,
  41, 45, 15, 21,  8,
  18,  2, 61, 56, 14,
];

// π permutation: piLane[src] = dest, where src = x + 5y, dest = y + 5*((2x+3y) % 5)
const PI_LANE = [
   0, 10, 20,  5, 15,
  16,  1, 11, 21,  6,
   7, 17,  2, 12, 22,
  23,  8, 18,  3, 13,
  14, 24,  9, 19,  4,
];

function rotl64(x: bigint, n: number): bigint {
  return ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK64;
}

function keccakF1600(state: bigint[]): void {
  const B = new Array<bigint>(25);
  const C = new Array<bigint>(5);
  const D = new Array<bigint>(5);

  for (let round = 0; round < 24; round++) {
    // θ step
    for (let x = 0; x < 5; x++) {
      C[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
    }
    for (let x = 0; x < 5; x++) {
      D[x] = C[(x + 4) % 5] ^ rotl64(C[(x + 1) % 5], 1);
      for (let y = 0; y < 25; y += 5) {
        state[x + y] = (state[x + y] ^ D[x]) & MASK64;
      }
    }

    // ρ and π steps
    const rotations = [
       0,  1, 62, 28, 27,
      36, 44,  6, 55, 20,
       3, 10, 43, 25, 39,
      41, 45, 15, 21,  8,
      18,  2, 61, 56, 14,
    ];
    const piLane = [
       0, 10,  7, 11, 17,
       5, 16,  2, 13, 22,
       1, 18, 23, 15, 24,
       4, 19,  9, 20,  3,
       6, 14, 12,  8, 21,
    ];
    for (let i = 0; i < 25; i++) {
      B[piLane[i]] = rotl64(state[i], rotations[i]);
    }

    // χ step
    for (let y = 0; y < 25; y += 5) {
      for (let x = 0; x < 5; x++) {
        state[y + x] = (B[y + x] ^ ((~B[y + (x + 1) % 5] & MASK64) & B[y + (x + 2) % 5])) & MASK64;
      }
    }

    // ι step
    state[0] = (state[0] ^ RC64[round]) & MASK64;
  }
}

/**
 * Keccak-256 hash of a Uint8Array.
 * Returns a hex string with 0x prefix.
 */
export function keccak256Bytes(data: Uint8Array): string {
  const rate = 136; // (1600 - 256*2) / 8
  const state = new Array<bigint>(25).fill(0n);

  // Absorb
  const padded = keccakPad(data, rate);
  for (let offset = 0; offset < padded.length; offset += rate) {
    for (let i = 0; i < rate; i += 8) {
      const laneIdx = (i / 8) | 0;
      let lane = 0n;
      for (let b = 0; b < 8; b++) {
        lane |= BigInt(padded[offset + i + b]) << BigInt(b * 8);
      }
      state[laneIdx] ^= lane;
    }
    keccakF1600(state);
  }

  // Squeeze (only need 32 bytes = 256 bits)
  let hex = '0x';
  for (let i = 0; i < 4; i++) {
    const lane = state[i];
    for (let b = 0; b < 8; b++) {
      const byte = Number((lane >> BigInt(b * 8)) & 0xFFn);
      hex += byte.toString(16).padStart(2, '0');
    }
  }
  return hex;
}

function keccakPad(data: Uint8Array, rate: number): Uint8Array {
  // Keccak padding: append 0x01, then zeros, then set last bit of last byte
  const q = rate - (data.length % rate);
  const padded = new Uint8Array(data.length + q);
  padded.set(data);
  padded[data.length] = 0x01;
  padded[padded.length - 1] |= 0x80;
  return padded;
}

/**
 * Keccak-256 hash of a UTF-8 string.
 * Returns a hex string with 0x prefix.
 */
export function keccak256Str(str: string): string {
  return keccak256Bytes(new TextEncoder().encode(str));
}

/**
 * Keccak-256 hash of hex-encoded bytes (with or without 0x prefix).
 * Returns a hex string with 0x prefix.
 */
export function keccak256Hex(hex: string): string {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return keccak256Bytes(bytes);
}

/**
 * Compute ENS namehash for a domain name.
 * namehash('') = 0x0000...
 * namehash('eth') = keccak256(namehash('') + keccak256('eth'))
 * namehash('foo.eth') = keccak256(namehash('eth') + keccak256('foo'))
 */
export function namehash(name: string): string {
  let node = '0x' + '0'.repeat(64); // bytes32(0)
  if (!name) return node;
  const labels = name.split('.');
  for (let i = labels.length - 1; i >= 0; i--) {
    const labelHash = keccak256Str(labels[i]);
    node = keccak256Hex(node.slice(2) + labelHash.slice(2));
  }
  return node;
}
