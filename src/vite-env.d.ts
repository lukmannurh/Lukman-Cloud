/**
 * Vite environment variable type declarations for Lukman Cloud.
 * All VITE_ prefixed variables are embedded in the browser bundle at build time.
 *
 * SECURITY NOTE: Every variable declared here is visible in the compiled JS bundle.
 * Do NOT add server-side secrets or any variable that should remain private.
 * The VITE_APP_TOTP_SECRET IS intentionally included here — it is expected to be
 * in the bundle (security model relies on Google OAuth Testing Mode for actual
 * server-side enforcement, not the secrecy of the TOTP secret).
 */

/// <reference types="vite/client" />

interface ImportMetaEnv {
  // ── Google OAuth 2.0 ──────────────────────────────────────────────────────
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_GOOGLE_REDIRECT_URI: string;

  // ── Telegram MTProto ──────────────────────────────────────────────────────
  readonly VITE_TELEGRAM_API_ID: string;
  readonly VITE_TELEGRAM_API_HASH: string;

  // ── TOTP Access Gate ──────────────────────────────────────────────────────
  /** Base32-encoded TOTP secret (RFC 4648). Used by src/lib/totp.ts */
  readonly VITE_APP_TOTP_SECRET: string;
  /** TOTP period in seconds. Defaults to 300 if not set. */
  readonly VITE_APP_TOTP_PERIOD: string | undefined;

  // ── App Metadata ──────────────────────────────────────────────────────────
  readonly VITE_APP_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
