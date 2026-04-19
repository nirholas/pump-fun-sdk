/**
 * Vanity mint grinder — runs entirely in a Web Worker.
 * Uses Web Crypto API Ed25519 — zero server calls, zero dependencies.
 * Messages in:  { type:"start", suffix, prefix, caseInsensitive, workerId }
 * Messages out: { type:"progress"|"found"|"error", ... }
 */

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function toBase58(bytes) {
  let x = BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''));
  const result = [];
  const base = BigInt(58);
  while (x > 0n) { result.unshift(BASE58[Number(x % base)]); x /= base; }
  for (const b of bytes) { if (b === 0) result.unshift('1'); else break; }
  return result.join('');
}

let useWebCrypto = false;

async function detectWebCrypto() {
  try {
    const k = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
    const raw = await crypto.subtle.exportKey('raw', k.publicKey);
    useWebCrypto = raw.byteLength === 32;
  } catch { useWebCrypto = false; }
}

async function generateKeypairWebCrypto() {
  const kp = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const priv = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey));
  const seed = priv.slice(16, 48);
  const secretKey = new Uint8Array(64);
  secretKey.set(seed, 0);
  secretKey.set(pub, 32);
  return { publicKey: pub, secretKey };
}

function generateKeypairFallback() {
  const seed = new Uint8Array(32);
  crypto.getRandomValues(seed);
  // TweetNaCl-free Ed25519: we rely on the nacl lib imported via importScripts
  // If not available, we skip — caller handles error
  if (typeof nacl === 'undefined') throw new Error('nacl not available');
  const kp = nacl.sign.keyPair.fromSeed(seed);
  return { publicKey: kp.publicKey, secretKey: kp.secretKey };
}

async function genKeypair() {
  return useWebCrypto ? generateKeypairWebCrypto() : generateKeypairFallback();
}

self.onmessage = async (e) => {
  const { type, suffix, prefix, caseInsensitive, workerId } = e.data;
  if (type !== 'start') return;

  await detectWebCrypto();

  const pfx = prefix ? (caseInsensitive ? prefix.toLowerCase() : prefix) : null;
  const sfx = suffix ? (caseInsensitive ? suffix.toLowerCase() : suffix) : null;

  const start = Date.now();
  let attempts = 0;
  const BATCH = 500;

  while (true) {
    for (let i = 0; i < BATCH; i++) {
      let kp;
      try { kp = await genKeypair(); } catch (err) {
        self.postMessage({ type: 'error', error: String(err) });
        return;
      }
      const addr = toBase58(kp.publicKey);
      const cmp = caseInsensitive ? addr.toLowerCase() : addr;
      attempts++;

      const ok = (!pfx || cmp.startsWith(pfx)) && (!sfx || cmp.endsWith(sfx));
      if (ok) {
        self.postMessage({
          type: 'found',
          workerId,
          publicKey: addr,
          secretKey: Array.from(kp.secretKey),
          attempts,
          durationMs: Date.now() - start,
        });
        return;
      }
    }

    const elapsed = (Date.now() - start) / 1000;
    const rate = elapsed > 0 ? Math.round(attempts / elapsed) : 0;
    self.postMessage({ type: 'progress', workerId, attempts, rate, elapsedMs: Date.now() - start });

    // yield to browser
    await new Promise(r => setTimeout(r, 0));
  }
};
