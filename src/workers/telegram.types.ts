/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Lukman Cloud — Telegram Web Worker Message Types
 * Milestone 1.4
 *
 * Defines the message-passing boundary between the main React thread and the
 * isolated Telegram GramJS Web Worker.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── State Machine States ───────────────────────────────────────────────────

export type TelegramWorkerState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'AWAITING_CODE'
  | 'AWAITING_PASSWORD'
  | 'AUTHENTICATED'
  | 'ERROR';

// ── Messages: Main Thread → Worker ─────────────────────────────────────────

export type WorkerCommand =
  | { type: 'CONNECT'; payload?: { apiId: number; apiHash: string; token?: string; sessionString?: string }; apiId?: number; apiHash?: string; sessionString?: string; botToken?: string }
  | { type: 'SEND_CODE'; phoneNumber: string }
  | { type: 'SUBMIT_CODE'; code: string; phoneCodeHash: string; phoneNumber: string }
  | { type: 'SUBMIT_PASSWORD'; password: string }
  | { type: 'DISCONNECT' }
  | { type: 'PING' }
  | { type: 'UPLOAD_FILE'; file: File; channelId: string; requestId: string }
  | { type: 'DOWNLOAD_FILE'; messageId: number; channelId: string; expectedHash: string; requestId: string };

// ── Messages: Worker → Main Thread ─────────────────────────────────────────

export type WorkerEvent =
  | { type: 'STATE_CHANGE'; state: TelegramWorkerState }
  | { type: 'CODE_REQUIRED'; phoneCodeHash: string; isCodeViaApp: boolean }
  | { type: 'PASSWORD_REQUIRED'; hint?: string }
  | { type: 'AUTHENTICATED'; sessionString: string }
  | { type: 'ERROR'; message: string; code?: string }
  | { type: 'PONG'; timestamp: number }
  | { type: 'UPLOAD_PROGRESS'; requestId: string; progress: number }
  | { type: 'UPLOAD_COMPLETE'; requestId: string; messageId: number; sha256: string }
  | { type: 'UPLOAD_ERROR'; requestId: string; error: string }
  | { type: 'DOWNLOAD_PROGRESS'; requestId: string; progress: number }
  | { type: 'DOWNLOAD_COMPLETE'; requestId: string; data: ArrayBuffer; verified: boolean }
  | { type: 'DOWNLOAD_ERROR'; requestId: string; error: string };
