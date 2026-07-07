/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AetherVault — Secure Admin Notification Client
 * Path: src/lib/notifyAdmin.ts
 *
 * Environment-Aware Hybrid Router:
 *
 *  DEVELOPMENT (import.meta.env.DEV = true, Vite localhost):
 *    → Calls the Telegram Bot API directly using VITE_TELEGRAM_BOT_TOKEN.
 *    → Token lives only in the local git-ignored .env file.
 *
 *  PRODUCTION (import.meta.env.PROD = true, deployed on Vercel):
 *    → Routes through POST /api/notify (Vercel Serverless proxy).
 *    → Raw token lives exclusively in Vercel server env — never in JS bundle.
 *
 * Chat ID Sanitization:
 *    GramJS uses raw IDs (e.g. -4405764561).
 *    The Telegram Bot HTTP API requires the -100 supergroup prefix
 *    (e.g. -1004405764561). formatBotChatId() handles this automatically.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const ADMIN_CHANNEL_ID = '-4405764561';

/**
 * Transforms a raw GramJS/MTProto channel ID into the format required by
 * the Telegram Bot HTTP API (supergroup -100 prefix convention).
 *
 * Examples:
 *   '-4405764561'   → '-1004405764561'
 *   '-1004405764561' → '-1004405764561'  (already correct, no-op)
 *   '123456789'      → '123456789'        (user/bot DM, no prefix needed)
 */
const formatBotChatId = (id: string): string => {
  if (id.startsWith('-') && !id.startsWith('-100')) {
    return `-100${id.slice(1)}`;
  }
  return id;
};

/**
 * Send a message to the Admin Channel.
 * Automatically switches between direct Telegram API (dev) and the
 * secure serverless proxy (prod). Never throws — failures are logged
 * silently so they never crash the auth UI.
 */
export async function notifyAdmin(
  message: string,
  chatId: string = ADMIN_CHANNEL_ID
): Promise<void> {
  const sanitizedChatId = formatBotChatId(chatId);

  try {
    if (import.meta.env.DEV) {
      // ── DEVELOPMENT: direct Telegram Bot API call ───────────────────────
      const token = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
      if (!token) {
        console.warn('[notifyAdmin] VITE_TELEGRAM_BOT_TOKEN not set. Add it to .env for local testing.');
        return;
      }
      const res = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: sanitizedChatId,
            text: message,
            parse_mode: 'HTML'
          })
        }
      );
      if (!res.ok) {
        const body = await res.text();
        console.warn('[notifyAdmin] Telegram API error:', res.status, body);
      }
      // Intentionally no success log — keep console clean on happy path
    } else {
      // ── PRODUCTION: route through Vercel serverless proxy ──────────────
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: sanitizedChatId, message })
      });
      if (!res.ok) {
        console.warn('[notifyAdmin] Proxy returned non-OK:', res.status);
      }
    }
  } catch (err) {
    // Silent failure — admin notifications must never crash the app
    console.warn('[notifyAdmin] Network error:', err);
  }
}
