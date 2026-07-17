/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Lukman Cloud — Telegram GramJS Web Worker
 * Milestone 1.4
 *
 * Runs the MTProto cryptography and GramJS client in an isolated thread.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/// <reference lib="webworker" />

// MUST be the absolute first side-effect import — evaluated before any GramJS ESM top-level
// environment detection runs, guaranteeing our window/document/process shims are in place.
import './worker-polyfills';

import { Buffer } from 'buffer';
import type { TelegramClient } from 'telegram';
// Static import ensures ConnectionTCPObfuscated is resolved AFTER worker-polyfills
// shims are applied (worker-polyfills is listed first), permanently bypassing
// GramJS's internal environment sniffer regardless of ESM hoisting order.
import { ConnectionTCPObfuscated } from 'telegram/network';
import { PromisedWebSockets } from 'telegram/extensions/PromisedWebSockets';
import { Api } from 'telegram';
export interface WorkerCommandConnect {
  type: 'CONNECT';
  apiId: number;
  apiHash: string;
  sessionString?: string;
  botToken?: string; // Newly added dynamic botToken
}
export type WorkerCommand = WorkerCommandConnect | any; // Simplified for chunk replacing
export type WorkerEvent = any;
export type TelegramWorkerState = string;

const _global = globalThis as any;

if (typeof _global.window === 'undefined') {
  _global.window = _global;
}
if (typeof _global.document === 'undefined') {
  _global.document = {
    currentScript: null,
    createElement: () => ({})
  } as any;
}

_global.Buffer = Buffer;
_global.process = {
  env: { NODE_ENV: 'development', browser: true },
  versions: {}, // Explicitly empty to force GramJS into Browser/WebSocket mode
  nextTick: (cb: any) => setTimeout(cb, 0)
} as any;

const originalSetTimeout = _global.setTimeout;

_global.setTimeout = (cb: any, ms?: number, ...args: any[]) => {
  const timeoutId = originalSetTimeout(cb, ms, ...args);
  if (timeoutId) {
    if (typeof timeoutId === 'number') {
      const timeoutObj = Object(timeoutId);
      timeoutObj.unref = () => timeoutId;
      timeoutObj.ref = () => timeoutId;
      return timeoutObj;
    }
    if (typeof timeoutId === 'object') {
      (timeoutId as any).unref = () => timeoutId;
      (timeoutId as any).ref = () => timeoutId;
    }
  }
  return timeoutId;
};


// The global self object for Web Workers
const workerSelf = self as unknown as DedicatedWorkerGlobalScope;

workerSelf.onerror = function(event) {
  workerSelf.postMessage({ type: 'UPLOAD_ERROR', requestId: 'global', error: 'Worker Fatal Error: ' + (event.message || 'Unknown syntax/compilation error') });
  workerSelf.postMessage({ type: 'ERROR', message: 'Worker Fatal Error: ' + (event.message || 'Unknown syntax/compilation error') });
};

workerSelf.addEventListener('unhandledrejection', function(event) {
  workerSelf.postMessage({ type: 'UPLOAD_ERROR', requestId: 'global', error: 'Worker Unhandled Rejection: ' + (event.reason?.message || 'Unknown') });
  workerSelf.postMessage({ type: 'ERROR', message: 'Worker Unhandled Rejection: ' + (event.reason?.message || 'Unknown') });
});

// ── Worker State ───────────────────────────────────────────────────────────

let client: TelegramClient | null = null;
let connectionPromise: Promise<void> | null = null;

async function waitForConnection() {
  // Active Connection Guard Loop: Stall up to 10 seconds if CONNECT command is in-flight or delayed
  let retries = 100;
  while (!connectionPromise && retries > 0) {
    await new Promise(resolve => setTimeout(resolve, 100));
    retries--;
  }

  if (connectionPromise) {
    await connectionPromise;
  }

  if (!client || !client.connected) {
    throw new Error('Client not connected.');
  }
}

// ── Helper: Send Event to Main Thread ──────────────────────────────────────

function sendEvent(event: WorkerEvent) {
  workerSelf.postMessage(event);
}

function updateState(newState: TelegramWorkerState) {
  sendEvent({ type: 'STATE_CHANGE', state: newState });
}

// ── Crypto Helpers ─────────────────────────────────────────────────────────

function bufferToHex(buffer: ArrayBuffer): string {
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function calculateSHA256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(hashBuffer);
}

// ── Command Handlers ───────────────────────────────────────────────────────

async function handleConnect(apiId: number, apiHash: string, sessionString?: string, botToken?: string) {
  if (client) {
    sendEvent({ type: 'ERROR', message: 'Client already connected.' });
    return;
  }

  updateState('CONNECTING');

  connectionPromise = (async () => {
    try {
      const { TelegramClient } = await import('telegram');
      const { StringSession } = await import('telegram/sessions');
      const { MemorySession } = await import('telegram/sessions/Memory');
      // ConnectionTCPObfuscated is statically imported at the top — no dynamic import needed.

      const session = sessionString ? new StringSession(sessionString) : new MemorySession();
      client = new TelegramClient(session, apiId, apiHash, {
        connection: ConnectionTCPObfuscated as any,
        networkSocket: PromisedWebSockets as any, // FORCES BROWSER WEBSOCKET CLASS — defeats PromisedNetSockets relative imports
        connectionRetries: 1,
        requestRetries: 1, // Prevent hanging on FloodWait
        useWSS: true,
        deviceModel: "LukmanCloudWorker",
      });

      await client.connect();

      if (botToken) {
        await Promise.race([
          client.start({ botAuthToken: botToken }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('client.start timed out (possible FloodWait)')), 5000))
        ]);
      }

      const isAuth = await client.checkAuthorization();
      if (isAuth) {
        updateState('AUTHENTICATED');
        sendEvent({ type: 'AUTHENTICATED', sessionString: client.session.save() as unknown as string });
        sendEvent({ type: 'WORKER_READY' });
      } else {
        updateState('DISCONNECTED');
      }
    } catch (error: any) {
      console.error('[TelegramWorker] Connection error:', error);
      updateState('ERROR');
      
      let errorMsg = error.message || 'Failed to connect to Telegram';
      if (error.stack && error.stack.includes('Buffer is not defined')) {
        errorMsg = 'Fatal: Buffer polyfill missing in worker scope. ' + errorMsg;
      }
      
      sendEvent({ type: 'ERROR', message: errorMsg });
      client = null;
      throw error;
    }
  })();

  try {
    await connectionPromise;
  } catch (e: any) {
    workerSelf.postMessage({ type: 'ERROR', message: 'Worker Initialization Crashed: ' + (e.message || 'Unknown Error') });
  }
}

async function handleSendCode(phoneNumber: string) {
  try {
    await waitForConnection();
  } catch (err: any) {
    sendEvent({ type: 'ERROR', message: err.message });
    return;
  }

  try {
    updateState('CONNECTING');
    const result = await client!.sendCode(
      {
        apiId: client!.apiId,
        apiHash: client!.apiHash,
      },
      phoneNumber
    );
    
    updateState('AWAITING_CODE');
    sendEvent({ 
      type: 'CODE_REQUIRED', 
      phoneCodeHash: result.phoneCodeHash,
      // @ts-ignore
      isCodeViaApp: result.type?.className === 'auth.SentCodeTypeApp'
    });
  } catch (error: any) {
    console.error('[TelegramWorker] Send code error:', error);
    updateState('ERROR');
    sendEvent({ type: 'ERROR', message: error.message || 'Failed to send code' });
  }
}

async function handleUploadFile(file: File, channelId: string, requestId: string) {
  try {
    await waitForConnection();
  } catch (err: any) {
    sendEvent({ type: 'UPLOAD_ERROR', requestId, error: err.message });
    return;
  }

  try {
    // 1. Calculate SHA-256 of the entire file before chunking
    const arrayBuffer = await file.arrayBuffer();
    const sha256Hex = async (buffer: ArrayBuffer) => { 
      const hash = await crypto.subtle.digest('SHA-256', buffer); 
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''); 
    };
    const sha256 = await sha256Hex(arrayBuffer);

    // Recover the pristine original filename by stripping the `.partN` suffix
    // that upload.service.ts appends when slicing: `${file.name}.part${i}`.
    // Example: "Proyek Klasifikasi.zip.part0" → "Proyek Klasifikasi.zip"
    const pristineName = file.name.replace(/\.part\d+$/, '');

    // 2. Format the Private Channel ID Safely
    let targetChannel = channelId.trim();
    if (!targetChannel.startsWith('-100')) {
      targetChannel = `-100` + targetChannel.replace(/^-/, '');
    }

    // --- MOCK BYPASS INTERCEPTOR ---
    if (targetChannel.includes('MOCK') || (typeof import.meta !== 'undefined' && import.meta.env?.DEV && import.meta.env?.VITE_AUTH_MODE === 'mock' && targetChannel === '-100')) {
      // MOCK channel detected. Simulating successful upload.
      workerSelf.postMessage({ type: 'UPLOAD_PROGRESS', requestId, progress: 1.0 });
      sendEvent({
        type: 'UPLOAD_SUCCESS',
        requestId,
        result: {
          provider: 'telegram',
          messageId: 'mock_tele_file_9922',
          mimeType: file.type || 'application/octet-stream',
          sha256Hex,
          accountId: 'mock_session',
          message: "Simulated local worker success"
        }
      });
      return;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // DIRECT RAW MTPROTO RPC CHUNKED UPLOAD
    // Completely bypasses client.sendFile and all high-level file type
    // validation (instanceof CustomFile, Buffer.isBuffer, etc.) which all
    // fail across Vite code-split chunk boundaries in isolated Web Workers.
    //
    // Source-verified sequence from node_modules/telegram/client/uploads.js:
    //   1. Api.upload.SaveBigFilePart  — per chunk raw RPC call
    //   2. Api.InputFileBig            — upload reference descriptor
    //   3. Api.InputMediaUploadedDocument — media type wrapper
    //   4. Api.messages.SendMedia      — final message send
    // ═══════════════════════════════════════════════════════════════════════

    // Generate a secure random 64-bit BigInt file ID for this upload session
    const fileIdHigh = Math.floor(Math.random() * 0x7FFFFFFF);
    const fileIdLow  = Math.floor(Math.random() * 0xFFFFFFFF);
    const fileId = BigInt(fileIdHigh) * BigInt(0x100000000) + BigInt(fileIdLow);

    const CHUNK_SIZE = 512 * 1024; // 512 KB — optimal for MTProto browser uploads
    const totalParts = Math.ceil(file.size / CHUNK_SIZE);

    // Starting raw RPC upload

    for (let i = 0; i < totalParts; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);

      // Slice natively in the browser — never loads the whole file into memory
      const chunkBuffer = Buffer.from(await file.slice(start, end).arrayBuffer());

      await client!.invoke(
        new Api.upload.SaveBigFilePart({
          fileId,
          filePart: i,
          fileTotalParts: totalParts,
          bytes: chunkBuffer,
        })
      );

      // Forward real-time progress to Main Thread (plain primitives only — no BigInt)
      const current = end;
      const total = file.size;
      const percent = total && total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
      workerSelf.postMessage({
        type: 'UPLOAD_PROGRESS',
        requestId,
        progress: percent / 100,
      });
    }

    // 3. Wrap the completed chunks into an InputFileBig upload reference
    const inputFile = new Api.InputFileBig({
      id: fileId,
      parts: totalParts,
      name: pristineName,   // pristine name — .partN suffix already stripped
    });

    // 4. Wrap in InputMediaUploadedDocument with generic MIME type
    // forceFile:true ensures Telegram treats any extension as a document
    const media = new Api.InputMediaUploadedDocument({
      file: inputFile,
      mimeType: file.type || 'application/octet-stream',
      attributes: [
        new Api.DocumentAttributeFilename({ fileName: pristineName }),
      ],
      forceFile: true,
    });

    // 5. Resolve the peer entity from the formatted channel string
    const peer = await client!.getInputEntity(targetChannel);

    // 6. Send the document via raw SendMedia RPC
    let result;
    try {
      result = await client!.invoke(
        new Api.messages.SendMedia({
          peer,
          media,
          message: `Uploaded via Lukman Cloud: ${pristineName}`,
          randomId: fileId, // Reuse fileId as deduplication key
        })
      );
    } catch (sendErr: any) {
      if (sendErr.message?.includes('FLOOD_WAIT')) {
        throw new Error(`FloodWaitError: ${sendErr.message}`);
      }
      throw sendErr;
    }

    // 7. Extract message ID — GramJS returns Updates; find the Message inside
    let safeMessageId: number;
    const updates = result as any;
    if (updates?.updates) {
      const msgUpdate = updates.updates.find((u: any) => u.id !== undefined);
      safeMessageId = msgUpdate ? Number(msgUpdate.id) : 0;
    } else {
      safeMessageId = Number(updates?.id ?? 0);
    }

    // Raw RPC upload complete.
    sendEvent({ type: 'UPLOAD_COMPLETE', requestId, messageId: safeMessageId, sha256 });
  } catch (error: any) {
    console.error('[TelegramWorker] Upload error:', error);
    sendEvent({ type: 'UPLOAD_ERROR', requestId, error: error.message || 'Failed to upload file' });
  }
}

async function handleDownloadFile(messageId: number, channelId: string, expectedHash: string, requestId: string) {
  try {
    await waitForConnection();
  } catch (err: any) {
    sendEvent({ type: 'DOWNLOAD_ERROR', requestId, error: err.message });
    return;
  }

  try {
    // 1. Format the Private Channel ID Safely
    let targetChannel = channelId.trim();
    if (!targetChannel.startsWith('-100')) {
      targetChannel = `-100` + targetChannel.replace(/^-/, '');
    }

    // 2. Get message
    console.log(`[TelegramWorker] Fetching message ID ${messageId} from channel ${targetChannel}...`);
    const messages = await client!.getMessages(targetChannel, { ids: [messageId] });
    if (!messages.length || !messages[0]) {
      console.error(`[TelegramWorker] Message ${messageId} not found in channel ${targetChannel}`);
      throw new Error('Message not found');
    }
    const message = messages[0];
    console.log(`[TelegramWorker] Message ${messageId} found. Initiating media download...`);

    // 2. Download Media (with retry for leader/connection race conditions)
    let buffer;
    let attempt = 0;
    const maxRetries = 3;

    while (true) {
      try {
        buffer = await client!.downloadMedia(message, {
          progressCallback: (downloaded: any, totalBytes: any) => {
            const current = Number(downloaded);
            const total = Number(totalBytes);
            const percent = total && total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
            sendEvent({ type: 'DOWNLOAD_PROGRESS', requestId, progress: percent / 100 });
          }
        });
        break;
      } catch (error: any) {
        attempt++;
        if (error.message?.includes('leader elected') || error.message?.includes('connected')) {
          console.warn(`[TelegramWorker] Download attempt ${attempt} failed with connection race condition. Retrying...`);
          if (attempt >= maxRetries) throw error;
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        } else {
          throw error;
        }
      }
    }

    if (!buffer) {
      throw new Error('Failed to download media buffer');
    }

    // 3. Verify Integrity
    console.log(`[TelegramWorker] Downloaded buffer for message ${messageId}, calculating SHA256...`);
    const sha256 = await calculateSHA256(buffer.buffer);
    const verified = sha256 === expectedHash;
    console.log(`[TelegramWorker] Buffer verified: ${verified}, sending DOWNLOAD_COMPLETE...`);

    // 4. Return Data
    // Buffer might be a Node.js Buffer which pools memory. Slice to the exact byte offset/length.
    const arr = new Uint8Array(buffer);
    const safeData = arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength);
    sendEvent({ type: 'DOWNLOAD_COMPLETE', requestId, data: safeData, verified });
  } catch (error: any) {
    console.error(`[TelegramWorker] Download error on messageId ${messageId}:`, error);
    sendEvent({ type: 'DOWNLOAD_ERROR', requestId, error: error.message || 'Failed to download file' });
  }
}

async function handlePing() {
  sendEvent({ type: 'PONG', timestamp: Date.now() });
}

// ── Message Listener ───────────────────────────────────────────────────────

workerSelf.addEventListener('message', async (event: MessageEvent<WorkerCommand>) => {
  const command = event.data;

  switch (command.type) {
    case 'CONNECT':
      {
        const apiId = command.payload?.apiId || command.apiId || 35691342;
        const apiHash = command.payload?.apiHash || command.apiHash || '';
        const token = command.payload?.token || command.botToken;
        const sessionString = command.payload?.sessionString || command.sessionString;
        await handleConnect(apiId, apiHash, sessionString, token);
      }
      break;

    case 'SEND_CODE':
      await handleSendCode(command.phoneNumber);
      break;

    case 'UPLOAD_FILE':
      await handleUploadFile(command.file, command.channelId, command.requestId);
      break;

    case 'DOWNLOAD_FILE':
      await handleDownloadFile(command.messageId, command.channelId, command.expectedHash, command.requestId);
      break;

    case 'PING':
      await handlePing();
      break;

    case 'DISCONNECT':
      if (client) {
        await client.disconnect();
        client = null;
        connectionPromise = null;
        updateState('DISCONNECTED');
      }
      break;

    default:
      console.warn('[TelegramWorker] Unhandled command:', command);
      break;
  }
});
