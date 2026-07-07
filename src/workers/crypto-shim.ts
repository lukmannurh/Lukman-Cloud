/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Lukman Cloud — Complete Browser Crypto Shim
 *
 * Provides a full Node-compliant `crypto` namespace for GramJS inside a
 * browser Web Worker. GramJS's CryptoFile.js requires synchronous:
 *   - randomBytes(size)           → filled Buffer of random bytes
 *   - createHash('sha256' | 'sha1') → chainable { update, digest } object
 *
 * All hashing is implemented in pure synchronous JS (no SubtleCrypto async).
 * Self-referencing interop: cryptoShim.default = cryptoShim defeats the Esbuild
 * CJS-to-ESM double-wrapper pattern where CryptoFile_1.default is an encapsulation proxy.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Buffer } from 'buffer';

// ── SHA-256 (pure synchronous JS) ──────────────────────────────────────────

function sha256_sync(buffer: Uint8Array): Uint8Array {
  const ch  = (x: number, y: number, z: number) => (x & y) ^ (~x & z);
  const maj = (x: number, y: number, z: number) => (x & y) ^ (x & z) ^ (y & z);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  const sigma0 = (x: number) => rotr(x, 2)  ^ rotr(x, 13) ^ rotr(x, 22);
  const sigma1 = (x: number) => rotr(x, 6)  ^ rotr(x, 11) ^ rotr(x, 25);
  const gamma0 = (x: number) => rotr(x, 7)  ^ rotr(x, 18) ^ (x >>> 3);
  const gamma1 = (x: number) => rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10);

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  const l = buffer.length;
  const paddingLen = (l % 64 < 56) ? (56 - l % 64) : (120 - l % 64);
  const padded = new Uint8Array(l + paddingLen + 8);
  padded.set(buffer);
  padded[l] = 0x80;

  const view = new DataView(padded.buffer);
  const bits = l * 8;
  view.setUint32(padded.length - 4, bits & 0xffffffff);
  if (bits > 0xffffffff) view.setUint32(padded.length - 8, Math.floor(bits / 0x100000000));

  for (let chunkStart = 0; chunkStart < padded.length; chunkStart += 64) {
    const W = new Uint32Array(64);
    for (let t = 0; t < 16; t++) W[t] = view.getUint32(chunkStart + t * 4);
    for (let t = 16; t < 64; t++) W[t] = (gamma1(W[t - 2]) + W[t - 7] + gamma0(W[t - 15]) + W[t - 16]) | 0;
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const T1 = (h + sigma1(e) + ch(e, f, g) + K[t] + W[t]) | 0;
      const T2 = (sigma0(a) + maj(a, b, c)) | 0;
      h = g; g = f; f = e; e = (d + T1) | 0;
      d = c; c = b; b = a; a = (T1 + T2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }

  const res = new Uint8Array(32);
  const resView = new DataView(res.buffer);
  for (let i = 0; i < 8; i++) resView.setUint32(i * 4, H[i]);
  return res;
}

// ── SHA-1 (pure synchronous JS) ────────────────────────────────────────────

function sha1_sync(buffer: Uint8Array): Uint8Array {
  const rol = (num: number, cnt: number) => (num << cnt) | (num >>> (32 - cnt));

  const l = buffer.length;
  const paddingLen = (l % 64 < 56) ? (56 - l % 64) : (120 - l % 64);
  const padded = new Uint8Array(l + paddingLen + 8);
  padded.set(buffer);
  padded[l] = 0x80;

  const view = new DataView(padded.buffer);
  const bits = l * 8;
  view.setUint32(padded.length - 4, bits & 0xffffffff);
  if (bits > 0xffffffff) view.setUint32(padded.length - 8, Math.floor(bits / 0x100000000));

  let H = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];

  for (let chunkStart = 0; chunkStart < padded.length; chunkStart += 64) {
    const W = new Uint32Array(80);
    for (let t = 0; t < 16; t++) W[t] = view.getUint32(chunkStart + t * 4);
    for (let t = 16; t < 80; t++) W[t] = rol(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1);
    let [a, b, c, d, e] = H;
    for (let t = 0; t < 80; t++) {
      let f = 0, k = 0;
      if (t < 20)      { f = (b & c) | ((~b) & d); k = 0x5A827999; }
      else if (t < 40) { f = b ^ c ^ d;             k = 0x6ED9EBA1; }
      else if (t < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
      else             { f = b ^ c ^ d;             k = 0xCA62C1D6; }
      const temp = (rol(a, 5) + f + e + k + W[t]) | 0;
      e = d; d = c; c = rol(b, 30); b = a; a = temp;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0;
    H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0;
  }

  const res = new Uint8Array(20);
  const resView = new DataView(res.buffer);
  for (let i = 0; i < 5; i++) resView.setUint32(i * 4, H[i]);
  return res;
}

// ── randomBytes ────────────────────────────────────────────────────────────

const _randomBytes = (size: number): Buffer => {
  const array = new Uint8Array(size);
  globalThis.crypto.getRandomValues(array);
  return Buffer.from(array.buffer);
};

// ── createHash ─────────────────────────────────────────────────────────────

const _createHash = (algorithm: string) => {
  const _buffers: Uint8Array[] = [];
  return {
    update(data: any): any {
      if (typeof data === 'string') {
        _buffers.push(new TextEncoder().encode(data));
      } else if (data instanceof Uint8Array || Buffer.isBuffer(data)) {
        _buffers.push(new Uint8Array(data));
      } else if (data instanceof ArrayBuffer) {
        _buffers.push(new Uint8Array(data));
      }
      return this;
    },
    digest(encoding?: string): any {
      const totalLength = _buffers.reduce((acc, b) => acc + b.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const b of _buffers) { combined.set(b, offset); offset += b.length; }

      const alg = algorithm.toLowerCase().replace(/[^a-z0-9]/g, '');
      let hashBuffer: Uint8Array;
      if (alg === 'sha256')      hashBuffer = sha256_sync(combined);
      else if (alg === 'sha1')   hashBuffer = sha1_sync(combined);
      else throw new Error(`[crypto-shim] Unsupported hash algorithm: ${algorithm}`);

      const resBuffer = Buffer.from(hashBuffer.buffer, hashBuffer.byteOffset, hashBuffer.byteLength);
      if (encoding === 'hex')    return resBuffer.toString('hex');
      if (encoding === 'base64') return resBuffer.toString('base64');
      return resBuffer;
    },
  };
};

// ── Exports — Self-referencing interop for Esbuild CJS-to-ESM encapsulation ──
//
// cryptoShim.default = cryptoShim is the ABSOLUTE DEFENSE against the pattern:
//   const CryptoFile_1 = require('crypto');
//   CryptoFile_1.default.createHash(...)
// When Esbuild wraps CJS as an ESM namespace, .default must point to the full
// object — not a frozen copy — so all methods remain callable.

const cryptoShim: any = {
  randomBytes: _randomBytes,
  createHash: _createHash,
};
cryptoShim.default = cryptoShim; // Self-reference: defeats CryptoFile_1.default proxy traps

export { _randomBytes as randomBytes, _createHash as createHash };
export default cryptoShim;
