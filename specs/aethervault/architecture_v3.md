# AetherVault — Telegram-Primary Architecture Spec
## Version 3.0 — Multi-Channel Storage Engine

---

## 1. Storage Architecture Overview

### Primary Backend: Telegram Unlimited Vault
- **Provider**: MTProto GramJS WebWorker thread
- **Upload Limit**: Up to 2 GB per file (chunked automatically at 1.9 GB boundaries)
- **Auth**: `VITE_TELEGRAM_API_ID` + `VITE_TELEGRAM_API_HASH` (Vite env, client-readable)
- **No file size restrictions** — the legacy `< 20 MB` Google Drive gate has been removed

### Secondary Backend: Google Drive Optional Mirror
- **Role**: Cold storage backup node, user-opt-in only
- **UI Toggle**: "Mirror Backup to Google Drive" pill button in VFS toolbar
- **Behaviour**: Mirror failure is non-fatal — primary upload to Telegram remains committed

---

## 2. Multi-Channel Dynamic Routing Matrix

Files are automatically routed to dedicated Telegram channels based on extension:

| Extension Group | Channel ID     | Description          |
|-----------------|----------------|----------------------|
| jpg/jpeg/png/gif/webp | `-4359856680` | Image Channel  |
| mp4/mkv/webm/avi      | `-4381141913` | Video Channel  |
| pdf/docx/txt/xlsx     | `-4398954359` | Document Channel |
| zip/rar/7z            | `-4477097252` | Archive Channel  |
| (all others)          | `-4294207603` | Global Fallback  |

Admin notification channel: `-4405764561`

Routing is implemented in `src/lib/services/upload.service.ts` via `resolveChannelId(filename)`.

---

## 3. Environment Variable Isolation

### Client-Side (VITE_ prefix, bundled safely)
```env
VITE_TELEGRAM_API_ID=35691342
VITE_TELEGRAM_API_HASH=84d8f1a2c0e9c4c09cff23316db186ec
VITE_APP_TOTP_SECRET=<redacted>
VITE_APP_GOOGLE_CLIENT_ID=<redacted>
```

### Server-Side Only (VERCEL_ prefix, never bundled)
```env
VERCEL_TELEGRAM_BOT_TOKEN=<redacted>
```

> **CRITICAL**: The bot token must NEVER be placed in a `VITE_` variable. Vite inlines all `VITE_` prefixed vars into the JS bundle which is visible in F12 DevTools.

---

## 4. Secure Serverless Bot Proxy

- **File**: `api/notify.ts` (Vercel Serverless Function)
- **Purpose**: Proxies Telegram Bot API calls from the client without ever exposing the token
- **Client call**: `POST /api/notify` with `{ chatId, message }` payload
- **Server action**: Uses `process.env.VERCEL_TELEGRAM_BOT_TOKEN` to call `https://api.telegram.org/bot.../sendMessage`
- **Client utility**: `src/lib/notifyAdmin.ts` wraps the proxy call

Admin notifications are dispatched for:
- New user registration events
- TOTP verification triggers
- Critical system events

---

## 5. Git Security

`.gitignore` excludes:
- `.env` (all variants via `.env.*`)
- `.env.local` and `.env.*.local`
- `.env.example` is the only env file committed (contains no real secrets)

---

## 6. Authentication Flow

- **Legacy**: Google OAuth (deprecated as primary), BYOS Configuration, Web-Crypto Master Password
- **Current**: Centralized `AuthGate.tsx` using Telegram-dispatched 6-digit TOTP validation
- **Centralization Rule**: The application no longer uses local storage encryption wizards or user-provided API credentials. All infrastructure access (Telegram API, Bot Token) is strictly centralized via server environment configurations and Vercel Serverless proxy node (`api/notify.ts`).

---

## 7. VFS Engine

- Global VFS registry powers `ExecutiveDashboard` aggregation (not folder-scoped)
- JSZip manifest extraction renders archive contents as structured table in preview modal
- Lucide React icon dictionary maps file extensions to colour-coded SVG icons

---

## 8. Telemetry Math Constraints

All progress values are bounded: `Math.min(100, Math.max(0, value))`
- Upload progress: clamped in `upload.service.ts` worker loop
- Download progress: clamped in `download.service.ts` chunk stitcher
