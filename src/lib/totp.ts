/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Lukman Cloud — TOTP Validation Library (Task 17.7)
 *
 * Zero-dependency, browser-native TOTP implementation.
 * Standard: RFC 6238 (TOTP) + RFC 4226 (HOTP base)
 *
 * Parameters (LOCKED per Requirement 26):
 *   Algorithm : HMAC-SHA-1
 *   Digits    : 6
 *   Period    : 300 seconds (5 minutes) — configurable via VITE_APP_TOTP_PERIOD
 *   Window    : current + previous (±1 window drift tolerance for clock skew)
 *   Secret    : Standard Base32 (RFC 4648 alphabet: A-Z, 2-7)
 *
 * This file has ZERO npm dependencies. All crypto is via window.crypto.subtle.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { TOTPValidationResult } from '../types';

// ── Constants ────────────────────────────────────────────────────────────────

/** RFC 4648 Base32 alphabet */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Default TOTP period in seconds (5 minutes) */
const DEFAULT_TOTP_PERIOD = 300;

/** Number of digits in the generated OTP */
const TOTP_DIGITS = 6;

// ── Base32 Decoder ────────────────────────────────────────────────────────────

/**
 * Decodes a Base32-encoded string (RFC 4648) into a Uint8Array.
 *
 * Handles:
 *   - Uppercase and lowercase input
 *   - Spaces (stripped)
 *   - '=' padding characters (stripped)
 *
 * Throws if the input contains characters outside the Base32 alphabet.
 */
export function base32Decode(secret: string): Uint8Array {
  // Normalize: uppercase, strip spaces and padding
  const normalized = secret.toUpperCase().replace(/\s+/g, '').replace(/=/g, '');

  if (normalized.length === 0) {
    throw new Error('[TOTP] base32Decode: empty secret after normalization');
  }

  // Validate all characters are in the Base32 alphabet
  for (const char of normalized) {
    if (!BASE32_ALPHABET.includes(char)) {
      throw new Error(
        `[TOTP] base32Decode: invalid character '${char}' in Base32 secret. ` +
          `Valid characters: A-Z and 2-7.`,
      );
    }
  }

  // Calculate output byte length
  // Every 8 Base32 chars = 5 bytes (40 bits)
  const outputLength = Math.floor((normalized.length * 5) / 8);
  const output = new Uint8Array(outputLength);

  let buffer = 0;
  let bitsLeft = 0;
  let outputIndex = 0;

  for (const char of normalized) {
    const charValue = BASE32_ALPHABET.indexOf(char);
    buffer = (buffer << 5) | charValue;
    bitsLeft += 5;

    if (bitsLeft >= 8) {
      bitsLeft -= 8;
      output[outputIndex++] = (buffer >> bitsLeft) & 0xff;
    }
  }

  return output;
}

// ── HOTP Core (RFC 4226) ──────────────────────────────────────────────────────

/**
 * Computes an HOTP value (RFC 4226) for a given HMAC key and counter.
 *
 * Algorithm:
 *   1. Encode counter as 8-byte big-endian integer
 *   2. Compute HMAC-SHA-1(key, counter)
 *   3. Apply dynamic truncation:
 *      - offset = hmac[19] & 0x0f
 *      - truncated = (hmac[offset..offset+4]) as 31-bit big-endian integer
 *   4. otp = truncated % 10^digits, left-padded to `digits` characters
 *
 * @param key     - Raw key bytes as ArrayBuffer
 * @param counter - HOTP counter value (BigInt for 64-bit safety)
 * @returns 6-digit OTP string, zero-padded
 */
async function computeHOTP(key: ArrayBuffer, counter: bigint): Promise<string> {
  // ── Step 1: Import the HMAC-SHA-1 key ──────────────────────────────────
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,           // extractable: false — key material stays in SubtleCrypto
    ['sign'],
  );

  // ── Step 2: Encode counter as 8-byte big-endian ArrayBuffer ────────────
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  // BigInt counter must fit in a uint64. Split into two 32-bit halves.
  const high = Number(counter >> 32n) >>> 0;
  const low  = Number(counter & 0xffffffffn) >>> 0;
  counterView.setUint32(0, high, false /* big-endian */);
  counterView.setUint32(4, low,  false /* big-endian */);

  // ── Step 3: Compute HMAC-SHA-1 ─────────────────────────────────────────
  const hmacBuffer = await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
  const hmac = new Uint8Array(hmacBuffer); // Length: 20 bytes for SHA-1

  // ── Step 4: Dynamic truncation (RFC 4226 §5.3) ─────────────────────────
  const offset = hmac[hmac.length - 1] & 0x0f; // Last nibble of HMAC

  // Extract 4 bytes starting at offset, mask the MSB to get a 31-bit int
  const truncated =
    ((hmac[offset]     & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) <<  8) |
     (hmac[offset + 3] & 0xff);

  // ── Step 5: Compute OTP (modulo 10^6, zero-padded to 6 digits) ─────────
  const otp = truncated % (10 ** TOTP_DIGITS);
  return otp.toString().padStart(TOTP_DIGITS, '0');
}

// ── TOTP Counter ──────────────────────────────────────────────────────────────

/**
 * Computes the TOTP counter for a given Unix timestamp and period.
 * counter = floor(timestampSeconds / period)
 */
function totpCounter(timestampSeconds: number, period: number): bigint {
  return BigInt(Math.floor(timestampSeconds / period));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Validates a 6-digit TOTP code entered by the user.
 *
 * Reads VITE_APP_TOTP_SECRET (Base32) and VITE_APP_TOTP_PERIOD (default: 300)
 * from Vite's build-time embedded environment variables.
 *
 * Accepts codes from:
 *   - The CURRENT time window (counter N)
 *   - The PREVIOUS time window (counter N-1) — clock drift tolerance per Req 26.4
 *
 * NEVER throws — all errors are caught and returned as { valid: false }.
 * The UI always shows the same generic error message regardless of fail reason.
 */
export async function validateTOTP(enteredCode: string): Promise<TOTPValidationResult> {
  try {
    // ── Read & validate environment configuration ─────────────────────────
    const secret = import.meta.env.VITE_APP_TOTP_SECRET;
    if (!secret || secret.trim() === '') {
      console.error('[TOTP] VITE_APP_TOTP_SECRET is not configured');
      return { valid: false, failReason: 'invalid_secret' };
    }

    const rawPeriod = import.meta.env.VITE_APP_TOTP_PERIOD;
    const period = rawPeriod ? parseInt(rawPeriod, 10) : DEFAULT_TOTP_PERIOD;
    if (isNaN(period) || period <= 0) {
      console.error(`[TOTP] Invalid VITE_APP_TOTP_PERIOD: "${rawPeriod}"`);
      return { valid: false, failReason: 'invalid_secret' };
    }

    // ── Validate input format (must be exactly 6 digits) ──────────────────
    const trimmedCode = enteredCode.trim();
    if (!/^\d{6}$/.test(trimmedCode)) {
      return { valid: false, failReason: 'wrong_code' };
    }

    // ── Decode Base32 secret ───────────────────────────────────────────────
    let keyBytes: Uint8Array;
    try {
      keyBytes = base32Decode(secret);
    } catch (err) {
      console.error('[TOTP] Failed to decode Base32 secret:', err);
      return { valid: false, failReason: 'decode_error' };
    }

    // ── Compute TOTP for current and previous window ───────────────────────
    const nowSeconds = Math.floor(Date.now() / 1000);
    const currentCounter  = totpCounter(nowSeconds, period);
    const previousCounter = currentCounter - 1n;

    const [currentOTP, previousOTP] = await Promise.all([
      computeHOTP(keyBytes.buffer, currentCounter),
      computeHOTP(keyBytes.buffer, previousCounter),
    ]);

    // ── Validate against both windows ─────────────────────────────────────
    if (trimmedCode === currentOTP || trimmedCode === previousOTP) {
      return { valid: true };
    }

    return { valid: false, failReason: 'wrong_code' };
  } catch (err) {
    // Catch all unexpected errors — never leak details to the user
    console.error('[TOTP] Unexpected error during validation:', err);
    return { valid: false, failReason: 'invalid_secret' };
  }
}

/**
 * Generates a TOTP code for the current time window.
 * USE ONLY FOR TESTING AND DEVELOPMENT.
 * This function should never be called in production UI.
 */
export async function __devGenerateTOTP(
  secret: string,
  period: number = DEFAULT_TOTP_PERIOD,
): Promise<string> {
  const keyBytes = base32Decode(secret);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const counter = totpCounter(nowSeconds, period);
  return computeHOTP(keyBytes.buffer, counter);
}
