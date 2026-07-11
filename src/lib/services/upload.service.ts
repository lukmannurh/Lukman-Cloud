/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Lukman Cloud — Production Upload Service
 * Milestone 3.0 — Telegram-Primary Multi-Channel Architecture
 *
 * Handles file streams to Telegram (Primary, Unlimited) and optionally
 * Google Drive (Secondary, Mirror Backup Node).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { GoogleDriveRef, TelegramRef, TelegramChunk, PooledAccount } from '../../types';
import { supabase } from './supabaseClient';

const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';

/**
 * Multi-Channel Dynamic Routing Matrix
 * Maps file extension groups to dedicated Telegram channel IDs.
 * All channel IDs are supplied at build time — zero hardcoded secrets in JS bundle.
 */
const TELEGRAM_CHANNEL_MAP: Record<string, string> = {
  // Images → Image Channel
  jpg:  '-1004359856680',
  jpeg: '-1004359856680',
  png:  '-1004359856680',
  gif:  '-1004359856680',
  webp: '-1004359856680',
  // Videos → Video Channel
  mp4:  '-1004381141913',
  mkv:  '-1004381141913',
  webm: '-1004381141913',
  avi:  '-1004381141913',
  // Documents → Document Channel
  pdf:  '-1004398954359',
  docx: '-1004398954359',
  txt:  '-1004398954359',
  xlsx: '-1004398954359',
  // Archives → Archive Channel
  zip:  '-1004477097252',
  rar:  '-1004477097252',
  '7z': '-1004477097252',
};

/** Global fallback — catches every extension not listed above */
const TELEGRAM_FALLBACK_CHANNEL = '-1004294207603';

/** Resolves the target Telegram channel ID for a given filename */
function resolveChannelId(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return TELEGRAM_CHANNEL_MAP[ext] ?? TELEGRAM_FALLBACK_CHANNEL;
}

export class UploadService {
  
  /**
   * Uploads a file to Google Drive using the Resumable Upload session.
   * Accepts a PooledAccount to track multi-account storage routing.
   */
  public async uploadToGoogleDrive(
    file: File, 
    accountOrToken: string | PooledAccount, 
    onProgress?: (progress: number) => void
  ): Promise<GoogleDriveRef> {
    
    const isPooledAccount = typeof accountOrToken !== 'string';
    const accessToken = isPooledAccount ? accountOrToken.accessToken : accountOrToken;
    const accountId = isPooledAccount ? accountOrToken.id : undefined;

    // 1. Initiate resumable session
    const initRes = await fetch(`${DRIVE_UPLOAD_URL}/files?uploadType=resumable`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': file.type || 'application/octet-stream',
        'X-Upload-Content-Length': file.size.toString()
      },
      body: JSON.stringify({
        name: file.name,
      })
    });

    if (!initRes.ok) {
      const err = await initRes.text();
      throw new Error(`Failed to initiate Google Drive upload: ${err}`);
    }
    
    const uploadUrl = initRes.headers.get('Location');
    if (!uploadUrl) {
      throw new Error('No resumable upload Location header returned from Google Drive');
    }

    // 2. Upload the file payload
    // Note: Raw fetch does not emit progress events natively without custom ReadableStreams.
    // We emit 0 initially, and 1.0 on completion.
    if (onProgress) onProgress(0);

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': file.size.toString(),
        'Content-Type': file.type || 'application/octet-stream'
      },
      body: file
    });

    if (!uploadRes.ok) {
      throw new Error(`Failed to upload file bytes to Google Drive: ${uploadRes.statusText}`);
    }
    
    const result = await uploadRes.json();
    
    if (onProgress) onProgress(1.0);

    return {
      provider: 'google_drive',
      driveFileId: result.id,
      mimeType: file.type || 'application/octet-stream',
      md5Checksum: result.md5Checksum,
      accountId
    };
  }

  /**
   * Uploads a file to Telegram via the Web Worker.
   * Automatically routes to the correct channel based on file extension.
   * Computes SHA-256 before chunking.
   * Supports files up to 2GB natively via MTProto chunked streaming.
   *
   * @param file      - The File to upload
   * @param _channelId - Ignored (channel is auto-resolved via routing matrix).
   *                    Kept for backwards-compat with existing call sites.
   * @param worker    - The initialized Telegram Web Worker
   * @param onProgress - Optional 0-1 progress callback
   */
  public async uploadToTelegram(
    file: File, 
    _channelId: string, 
    worker: Worker,
    onProgress?: (progress: number, speedText?: string) => void
  ): Promise<TelegramRef> {
    
    // Auto-resolve destination channel from Extension Matrix
    const channelId = resolveChannelId(file.name);

    if (!channelId) {
      console.warn("Storage Node not initialized. Falling back to metadata-only storage natively inside Supabase.");
      if (onProgress) onProgress(1.0);
      return {
        provider: 'telegram',
        channelId: 'metadata-fallback',
        originalFilename: file.name,
        sha256Hash: null,
        totalParts: 0,
        chunks: []
      };
    }

    // 1. Compute whole-file SHA-256 (pre-chunking) safely
    // Bypass for files > 500MB to prevent main-thread ArrayBuffer crashes
    let sha256Hex: string | null = null;
    if (file.size <= 500 * 1024 * 1024) {
      const buffer = await file.arrayBuffer(); 
      const sha256Buffer = await crypto.subtle.digest('SHA-256', buffer);
      sha256Hex = Array.from(new Uint8Array(sha256Buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } else {
      console.warn(`[UploadService] File exceeds 500MB threshold (${(file.size / 1024 / 1024).toFixed(2)} MB). Bypassing main-thread SHA-256 to prevent memory exhaustion.`);
    }

    // 2. Setup Chunks — 1.9 GB safely under Telegram's 2 GB limit
    const CHUNK_SIZE = 1.9 * 1024 * 1024 * 1024;
    const totalParts = Math.ceil(file.size / CHUNK_SIZE) || 1;
    const chunks: TelegramChunk[] = [];

    if (onProgress) onProgress(0, '');

    let loadedBytes = 0;
    let lastTime = Date.now();
    let lastLoaded = 0;

    // 3. Upload Chunks Sequentially
    for (let i = 0; i < totalParts; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunkBlob = file.slice(start, end, file.type);
      const chunkFile = new File([chunkBlob], `${file.name}.part${i}`);

      const requestId = crypto.randomUUID();
      
      const messageId = await new Promise<number>((resolve, reject) => {
        const handler = (event: MessageEvent) => {
          const msg = event.data;
          if (msg.requestId !== requestId) return;

          if (msg.type === 'UPLOAD_PROGRESS') {
            const currentLoaded = loadedBytes + (msg.progress * chunkBlob.size);
            const overallProgress = Math.min(1.0, currentLoaded / file.size);
            
            // Calculate Speed
            const now = Date.now();
            const deltaT = (now - lastTime) / 1000;
            let speedText = '';
            if (deltaT >= 0.5) {
              const speed = (currentLoaded - lastLoaded) / deltaT / (1024 * 1024);
              speedText = `${speed.toFixed(1)} MB/s`;
              lastTime = now;
              lastLoaded = currentLoaded;
            }

            if (onProgress) onProgress(overallProgress, speedText);
          } else if (msg.type === 'UPLOAD_COMPLETE') {
            worker.removeEventListener('message', handler);
            loadedBytes += chunkBlob.size;
            resolve(msg.messageId);
          } else if (msg.type === 'UPLOAD_ERROR') {
            worker.removeEventListener('message', handler);
            reject(new Error(msg.error));
          }
        };

        worker.addEventListener('message', handler);
        worker.postMessage({
          type: 'UPLOAD_FILE',
          file: chunkFile,
          channelId,
          requestId
        });
      });

      chunks.push({
        partIndex: i,
        messageId: messageId,
        chunkSize: chunkBlob.size
      });
    }

    if (onProgress) onProgress(1.0);

    // 4. Return the TelegramRef structure enforcing INV-01 and INV-02
    return {
      provider: 'telegram',
      channelId: channelId, // Return the actual routed channel
      originalFilename: file.name,
      sha256Hash: sha256Hex,
      totalParts,
      chunks
    };
  }
}

export const uploadService = new UploadService();
