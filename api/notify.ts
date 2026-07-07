import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AetherVault — Secure Serverless Bot Proxy
 * Path: api/notify.ts (Vercel Serverless Function)
 *
 * Transforms raw GramJS channel IDs (e.g. -4405764561) into the -100
 * supergroup prefix format required by the Telegram Bot HTTP API
 * (e.g. -1004405764561) before every dispatch call.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Sanitize GramJS raw channel IDs for Telegram Bot API compatibility.
 * The Bot API requires supergroup/channel IDs to carry the -100 prefix.
 */
const formatBotChatId = (id: string): string => {
  if (id.startsWith('-') && !id.startsWith('-100')) {
    return `-100${id.slice(1)}`;
  }
  return id;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const botToken = process.env.VERCEL_TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('[notify] VERCEL_TELEGRAM_BOT_TOKEN is not set on the server');
    return res.status(500).json({ error: 'Bot service not configured' });
  }

  const { chatId, message } = req.body as { chatId?: string; message?: string };

  if (!chatId || !message) {
    return res.status(400).json({ error: 'Missing required fields: chatId, message' });
  }

  const sanitizedChatId = formatBotChatId(chatId);

  try {
    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
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

    if (!tgRes.ok) {
      const errBody = await tgRes.text();
      console.error('[notify] Telegram API error:', errBody);
      return res.status(502).json({ error: 'Telegram API rejected the request', detail: errBody });
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[notify] Proxy fetch failed:', err.message);
    return res.status(500).json({ error: 'Internal proxy error' });
  }
}
