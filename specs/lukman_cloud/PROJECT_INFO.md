# Lukman Cloud — Specification Directory

> **Project Name:** Lukman Cloud  
> **Formerly Known As:** AetherVault (internal codename, retired)  
> **Workspace:** `D:\luke project\LukmanCloud`  
> **Deployment Target:** Vercel Free Tier (static site)  
> **Architecture:** 100% Client-Side, BYOS Multi-User Model

## Specification Files

The canonical specification files are located in `../aethervault/` (the Kiro tool manages
spec identity via `.config.kiro`). All files have been fully rebranded to **Lukman Cloud**:

| File | Description | Status |
|------|-------------|--------|
| [`../aethervault/design.md`](../aethervault/design.md) | Technical design, architecture, component interfaces, security model | ✅ Rebranded |
| [`../aethervault/requirements.md`](../aethervault/requirements.md) | 27 functional requirements (incl. Req 26: Access Code Gate, Req 27: OAuth Guard) | ✅ Rebranded |
| [`../aethervault/tasks.md`](../aethervault/tasks.md) | 17 implementation task sections (incl. Section 17: Access Control) | ✅ Rebranded |

> **Note:** The spec directory is named `aethervault/` because the Kiro tool uses
> the `.config.kiro` file with a fixed `specId` to track the spec. Renaming the directory
> would require updating the Kiro config. The CONTENTS of all spec files use "Lukman Cloud"
> exclusively. You may safely rename the directory to `lukman_cloud/` if you update
> `.config.kiro` accordingly.

## Project Identity

| Property | Value |
|----------|-------|
| **Public App Name** | Lukman Cloud |
| **Internal Codename** | lukman-cloud |
| **Target Users** | Lukman + family members, close friends, relatives |
| **Access Model** | Bring-Your-Own-Storage (BYOS) — each user uses their own Google Drive + Telegram |
| **Access Control** | Client-side Access Code Gate + Google OAuth Testing Mode whitelist |
| **Phase 0 Status** | ✅ Architecture locked and audited (Milestone 3 Dynamically Audited via Live E2E Browser Interaction using explicit production Telegram parameters) |
| **Phase 1 Status** | 🔲 Ready to start — awaiting code generation approval |

## Key Architectural Decisions (Locked)

1. **Zero-Backend Architecture** — Vercel hosts only static assets; all I/O is client-to-cloud
2. **BYOS Model** — No shared backend; each user's data lives in their own Google Drive + Telegram
3. **Access Code Gate** — `VITE_APP_ACCESS_CODE` env var gates vault initialization
4. **Google OAuth Testing Mode** — Server-side whitelist at Google's infrastructure; cannot be bypassed
5. **IndexedDB Security** — `aethervault_secure_vault` DB; `ArrayBuffer` storage; AES-256-GCM; PBKDF2 600k iterations; salt: 32 bytes; `extractable: false`
6. **Directory-Split Metadata** — Each folder is `folder_{uuid}.json` in Google Drive `appDataFolder`
7. **ETag Optimistic Locking** — Prevents concurrent metadata write conflicts
8. **BroadcastChannel Leader Election** — Serializes writes across multiple browser tabs
9. **GramJS Web Worker** — Non-blocking Telegram MTProto operations
10. **Unified VFSEntry Schema** — `entries: VFSEntry[]` discriminated union (not split children/subfolders)
11. **Strict Pipeline Bifurcation** — Files <= 20MB are hard-routed to Google Drive and absolutely insulated from Telegram lifecycle.
12. **Ephemeral Telegram Sessions** — GramJS Web Worker uses isolated `MemorySession` with `workers: 1` and explicit `DISCONNECT` cleanup to eliminate multi-tab leader election deadlocks.
13. **Clean Metadata Fallback** — VFS dynamically falls back to local save payloads if a brand-new folder lacks a remote `folderDocumentDriveId` to fetch.
14. **Worker Boundary Traps** — Dev server reload hooks are intercepted via `e.preventDefault()` on Web Workers, converting catastrophic unhandled worker crashes into isolated UI state warnings.
15. **Global Context Shims & Dynamic Imports** — Telegram Web Workers mandate execution-first polyfills (including `globalThis.Buffer`, `process`, `os`, a global `exports` object, and a functional `require` shim) explicitly declared at the top of the file, combined with Dynamic Asynchronous Imports for `telegram` dependencies, to defeat Vite ESM chunk hoisting race conditions and legacy CommonJS/Node execution panics.
16. **Lazy-Loading Connection Gate** — Dynamically spawned workers must explicitly stall `UPLOAD_FILE` operations using an active connection guard loop until the asynchronous `TelegramClient.connect()` network handshake fully resolves.
17. **OAuth Bootup VFS Sync** — Upon OAuth token resolution, the metadata engine must dynamically scan `appDataFolder` to resolve the true Drive ID of `folder_root.json` and sync it to the UI before permitting fallback template generation, preventing local UI state desynchronization.
18. **Esbuild Pre-Bundling Alias** — The application enforces Compile-Time Vite Aliases for both `os` (`src/workers/os-shim.ts`) and `crypto` (`src/workers/crypto-shim.ts`). The crypto shim provides a fully Node-compliant namespace with: (a) synchronous `randomBytes` via `globalThis.crypto.getRandomValues`, and (b) synchronous `createHash('sha256' | 'sha1')` implemented in pure JS (hand-rolled RFC-compliant SHA-256 and SHA-1). Without this shim, GramJS's `CryptoFile.js` has no crypto namespace and crashes immediately. Both aliases are enforced in `resolve.alias` (Rollup) and the `esbuild-worker-alias-fix` plugin (Esbuild pre-bundling pass). Double-default export structure survives Esbuild CJS-to-ESM interop wrapping.
19. **Automated 404 VFS Metadata Pruning** — If a file download from Google Drive triggers a 404 error (due to manual external deletion), the VFS gracefully intercepts the crash, auto-prunes the orphaned record from `currentFolderDoc`, and immediately synchronizes the cleaned metadata back to the cloud. This background loop explicitly resolves and passes the true Drive ID of `folder_root.json` to prevent 403 Access Token collisions on the fallback identifier.
20. **Development Runtime Integrity Parity** — The active development shell (`npm run dev`) is programmatically audited against Vite optimization loops, verifying that the dynamic runtime environment mirrors the zero-trust isolation invariants established in the production build stack (including alias resolutions and dynamic worker bootup).
21. **Browser Environment Inversion** — GramJS's internal environment sniffer is explicitly tricked into native browser mode by ensuring `process.versions.node` evaluates to undefined and forcing `process.env.browser = true`. Additionally, the global `setTimeout` is guarded to return safe `.unref()` and `.ref()` stubs, preventing legacy Node TCP/timer loops from freezing the browser transport layer.
22. **Secure WebSocket Gateway Simulation** — Because isolated Web Workers lack a DOM, GramJS defaults to Node mode and attempts invalid unencrypted raw TCP connections. To defeat this, `window` and `document` are explicitly simulated on `globalThis` at the top of the worker, and `useWSS: true` is strictly passed to the `TelegramClient` constructor, forcing all MTProto traffic to route exclusively over Telegram's secure public WebSocket cluster (`wss://` port 443).
23. **ESM Hoisting Fix via Explicit Connection Injection** — Because ES Module imports are hoisted and executed before the worker body runs, GramJS's top-level environment sniffer fires before our `window`/`process` shims can be applied. This is permanently defeated by: (a) making `import './worker-polyfills'` the absolute first side-effect import in `telegram.worker.ts`, and (b) statically importing `ConnectionTCPObfuscated` from `telegram/network` and explicitly passing it as the `connection` option in the `TelegramClient` constructor, fully bypassing GramJS's internal environment detection and guaranteeing the browser WebSocket transport channel.
24. **PromisedNetSockets → PromisedWebSockets Bundler Alias** — Vite's isolated Web Worker compilation pass ignores the `package.json` `"browser"` field mappings inside the `telegram` package. Fixed via: (a) an explicit `resolve.alias` entry redirecting `telegram/extensions/PromisedNetSockets` to `PromisedWebSockets`, and (b) a broad `/PromisedNetSockets/` regex `onResolve` hook in the `esbuild-worker-alias-fix` plugin to capture both absolute module IDs and relative internal GramJS imports (e.g. `../../extensions/PromisedNetSockets`). Additionally, `PromisedWebSockets` is statically imported and explicitly passed as `networkSocket` in the `TelegramClient` constructor, providing a final constructor-level guarantee that the browser WebSocket class is used regardless of bundler resolution.

## Pre-Phase 1 Checklist

Before generating any source code, ensure:

- [ ] `VITE_APP_ACCESS_CODE` value decided and ready for Vercel dashboard
- [ ] Google Cloud Console project created with OAuth PKCE client ID
- [ ] Gmail addresses of all initial trusted users known (for test user list)
- [ ] Telegram API ID and API Hash obtained from https://my.telegram.org
- [ ] Telegram channel(s) created for file storage (one per user, or shared strategy decided)
- [ ] All spec files reviewed and approved by Lukman
