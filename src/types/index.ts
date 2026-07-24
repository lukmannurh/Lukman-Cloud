/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Lukman Cloud — Core Type System
 * Phase 0 Locked Schema (Milestone 1.2)
 *
 * ALL interfaces in this file are derived from the Phase 0 Technical
 * Specification (design.md). DO NOT modify any interface without updating
 * the corresponding spec section and getting architectural review.
 *
 * Key invariants enforced by types:
 *   - GoogleDriveRef.provider === 'google_drive'  (LOCKED discriminant)
 *   - TelegramRef.provider    === 'telegram'       (LOCKED discriminant)
 *   - FolderDocument.entries  is VFSEntry[]        (unified discriminated union)
 *   - chunks[i].partIndex     === i                (INV-02, enforced at runtime)
 *   - IndexedDB binary fields are ArrayBuffer      (NOT base64 strings)
 *   - CryptoKey.extractable   === false            (SEC-01, enforced in deriveKey)
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// § 1 — VFS Entry Types
// ═══════════════════════════════════════════════════════════════════════════

export type VFSEntryType = 'file' | 'folder';

/**
 * Discriminated union of all direct children within FolderDocument.entries[].
 * Use the `type` field as the discriminant for narrowing.
 */
export type VFSEntry = VFSFile | VFSFolder;

/** Base fields shared by all VFS entries. */
export interface VFSEntryBase {
  /** UUID v4 — globally unique across ALL entries in the storage */
  id: string;
  type: VFSEntryType;
  /** Display name — validated to exclude path traversal chars (/, \, ..) */
  name: string;
  /** ISO 8601 UTC timestamp */
  createdAt: string;
  /** ISO 8601 UTC timestamp — updated on every metadata write */
  modifiedAt: string;
  starred: boolean;
}

/** A file stored in one of the cloud backends. */
export interface VFSFile extends VFSEntryBase {
  type: 'file';
  mimeType: string;
  /** TOTAL original file size in bytes (NOT per-chunk size) */
  size: number;
  uploadStatus: 'pending' | 'complete' | 'failed';
  /** Storage provider reference. Use `ref.provider` discriminant to narrow. */
  ref: GoogleDriveRef | TelegramRef;
}

/** A folder — points to a separate FolderDocument stored in Drive appDataFolder. */
export interface VFSFolder extends VFSEntryBase {
  type: 'folder';
  /** UUID v4 — matches the filename `folder_{folderId}.json` in Drive appDataFolder */
  folderId: string;
  /** Google Drive file ID of the `folder_{folderId}.json` document — needed for PATCH/DELETE */
  folderDocumentDriveId: string;
}

/**
 * Isolated Virtual File System Node
 * This replaces the physical Google Drive folder mapping, allowing arbitrary local directory structures.
 */
export interface VFSNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string; // e.g., "/Projects/Data"
  parentId: string | null;
  children?: string[]; // Array of child node IDs if type is 'folder'
  storageRef?: {
    provider: 'gdrive' | 'telegram';
    accountId?: string;
    fileId?: string;
    channel_id?: string;
    message_id?: number;
  };
  // Additional metadata for UI
  size?: number;
  mimeType?: string;
  createdAt?: string;
  modifiedAt?: string;
  rawRef?: GoogleDriveRef | TelegramRef | any; // Hold original reference for advanced operations (e.g., Telegram chunks)
  telegramChannelId?: string; // Resolved destination Channel ID for downstream fetching
  telegramMessageId?: number; // Single message ID
  googleDriveFileId?: string;
  parts?: any;
  blocks?: any;
  telegramFileId?: string | number | null;
  telegram_file_id?: string | number | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// § 2 — Folder Document (Metadata Schema)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The metadata document for a single folder, stored as `folder_{folderId}.json`
 * in Google Drive's appDataFolder.
 *
 * Phase 0 AD-02: Directory-split metadata — navigation loads EXACTLY ONE
 * FolderDocument at a time. The full tree is NEVER loaded into memory.
 *
 * INVARIANT: entries[i].type === 'file' | 'folder' (no other entry types)
 */
export interface FolderDocument {
  /** Schema version for future migration support */
  schemaVersion: 1;
  /**
   * 'root' for the root document (stored as `folder_root.json`).
   * UUID v4 for all other folders.
   */
  folderId: string | 'root';
  /** null ONLY for the root folder. UUID v4 for all other folders. */
  parentFolderId: string | null;
  folderName: string;
  /** ISO 8601 UTC */
  createdAt: string;
  /** ISO 8601 UTC — MUST be updated on every write */
  modifiedAt: string;
  /**
   * Google Drive ETag for this folder document.
   * MUST be included in PATCH requests to detect concurrent write conflicts.
   * MUST be updated from the API response after every successful write.
   */
  etag: string;
  /**
   * Google Drive file ID of THIS folder document.
   * Used for targeted PATCH (update) and DELETE (delete folder) operations.
   */
  selfDriveId: string;
  /**
   * All direct children — both files AND subfolders in a SINGLE unified array.
   * NOT split into separate `children[]` + `subfolders[]` fields.
   * Use VFSEntry `type` discriminant to separate files from folders.
   */
  entries: VFSEntry[];
}

// ═══════════════════════════════════════════════════════════════════════════
// § 3 — Storage Provider References
// ═══════════════════════════════════════════════════════════════════════════

/**
 * File stored directly in Google Drive (≤ ~20MB threshold).
 * LOCKED discriminant: provider === 'google_drive' (NOT 'gdrive')
 */
export interface GoogleDriveRef {
  provider: 'google_drive';
  /** Google Drive file ID — used for download, delete, and metadata operations */
  driveFileId: string;
  mimeType: string;
  /** MD5 checksum from Google Drive API — for post-download reliability verification */
  md5Checksum?: string;
  /** UUID of the PooledAccount that owns this file for multi-account routing */
  accountId?: string;
}

/**
 * File stored in Telegram (files > ~20MB threshold, or up to unlimited size).
 * Files are split into 2GB chunks, each uploaded as a separate message.
 * LOCKED discriminant: provider === 'telegram' (NOT 'tg')
 *
 * INVARIANT INV-01: totalParts === chunks.length
 * INVARIANT INV-02: chunks[i].partIndex === i for all i (0-based, sequential)
 */
export interface TelegramRef {
  provider: 'telegram';
  /** Numeric Telegram channel ID as string (e.g. '-1001234567890') */
  channelId: string;
  originalFilename: string;
  /**
   * SHA-256 hash of the COMPLETE reassembled file, computed BEFORE chunking.
   * Verified AFTER full reassembly on download.
   * null if the file was uploaded before reliability hashing was implemented.
   */
  sha256Hash: string | null;
  /** MUST equal chunks.length — INVARIANT INV-01 */
  totalParts: number;
  /**
   * Ordered array of chunk references.
   * INVARIANT INV-02: chunks[i].partIndex === i for all i.
   * This invariant MUST be validated before writing to metadata.
   */
  chunks: TelegramChunk[];
}

/**
 * A single chunk entry in TelegramRef.chunks.
 * INVARIANT: chunks[i].partIndex === i (0-based, strictly sequential)
 */
export interface TelegramChunk {
  /** 0-based index — chunks MUST be in order */
  partIndex: number;
  /** Telegram message ID of this chunk (numeric, not stringified) */
  messageId: number;
  /** Byte size of this specific chunk — sum of all chunkSize values == original file size */
  chunkSize: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// § 4 — Storage Routing & Quota
// ═══════════════════════════════════════════════════════════════════════════

export type StorageBackend = 'google_drive' | 'telegram';

export interface QuotaInfo {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  /**
   * Safety buffer — never upload if the file would bring usage within this margin.
   * Default: 500MB. Prevents accidental quota exhaustion.
   */
  safetyBufferBytes: number;
}

/** Resolved storage routing decision for a given file */
export interface StorageRoutingDecision {
  backend: StorageBackend;
  reason: 'size_under_threshold' | 'google_quota_insufficient' | 'explicit_override';
}

// ═══════════════════════════════════════════════════════════════════════════
// § 5 — Session & Security
// ═══════════════════════════════════════════════════════════════════════════

/**
 * In-memory session state held by SessionManager.
 * The CryptoKey MUST NEVER be serialized, logged, or persisted.
 * It exists only in volatile memory while the storage is unlocked.
 */
export interface SessionState {
  isUnlocked: boolean;
  /**
   * AES-256-GCM CryptoKey derived from Master Password via PBKDF2.
   * Phase 0 SEC-01: MUST be created with extractable: false.
   * null when storage is locked.
   */
  encryptionKey: CryptoKey | null;
  idleTimeoutHandle: ReturnType<typeof setTimeout> | null;
  unlockTimestamp: number | null;
}

/**
 * Parameters used for PBKDF2 key derivation.
 * Phase 0 SEC-04: salt MUST be 32 bytes (256-bit).
 */
export interface SecurityParams {
  /** 32 bytes (256-bit) CSPRNG output — NOT 16 bytes */
  salt: Uint8Array;
  /** LOCKED: 600,000 iterations (OWASP 2023 minimum for PBKDF2-SHA256) */
  iterations: number;
}

/** AES-256-GCM encrypted payload */
export interface EncryptedData {
  /** 12 bytes (96-bit) fresh random IV — unique per encryption call */
  iv: Uint8Array;
  /** Ciphertext with 128-bit GCM authentication tag appended by SubtleCrypto */
  ciphertext: Uint8Array;
}

// ═══════════════════════════════════════════════════════════════════════════
// § 6 — IndexedDB Record Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * IndexedDB: database `aethervault_secure_vault`
 * Object store: `security_params` | keyPath: 'id'
 *
 * Phase 0: salt stored as raw ArrayBuffer, NOT base64 string.
 * IndexedDB is binary-safe — no encoding roundtrip needed.
 */
export interface SecurityParamsRecord {
  /** Fixed key — single record per storage */
  id: 'master_salt';
  /** Raw 32-byte (256-bit) ArrayBuffer — stored natively, never base64 encoded */
  salt: ArrayBuffer;
  /** ISO 8601 UTC */
  createdAt: string;
}

export interface VaultVersionRecord {
  id: 'vault_version';
  /** IndexedDB schema version — for future migrations */
  version: number;
  createdAt: string;
}

/**
 * IndexedDB: database `aethervault_secure_vault`
 * Object store: `encrypted_credentials` | keyPath: 'credentialKey'
 *
 * Phase 0: iv and ciphertext stored as ArrayBuffer, NOT base64 strings.
 * Binary storage avoids encoding bugs and is more efficient.
 */
export interface EncryptedCredentialRecord {
  credentialKey: 'telegram_session' | 'google_oauth_tokens' | 'app_config' | 'pooled_accounts';
  /** Raw 12-byte ArrayBuffer IV — NOT base64 encoded */
  iv: ArrayBuffer;
  /**
   * Raw AES-256-GCM output ArrayBuffer, including the 128-bit GCM auth tag
   * automatically appended by SubtleCrypto.encrypt(). NOT base64 encoded.
   */
  ciphertext: ArrayBuffer;
  /** ISO 8601 UTC — for debugging and audit */
  encryptedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// § 7 — Decrypted Credential Structures (plaintext in memory ONLY)
// ═══════════════════════════════════════════════════════════════════════════

/** Google OAuth 2.0 tokens — NEVER persisted in plaintext */
export interface GoogleOAuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix timestamp in milliseconds — compare with Date.now() */
  expiresAt: number;
}

/** Pooled multi-account credential */
export interface PooledAccount {
  id: string;          // UUID — stable across token refreshes
  email: string;       // From Google userinfo API
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;   // Unix ms
  usedQuota: number;   // bytes
  totalQuota: number;  // bytes (0 = unlimited/GSuite)
}

/**
 * GramJS StringSession.save() output.
 * NEVER stored in plaintext — always encrypted before IndexedDB write.
 */
export interface TelegramSessionCredentials {
  sessionString: string;
}

/** Application configuration — encrypted at rest in IndexedDB */
export interface AppConfig {
  /** Numeric Telegram channel ID as string (e.g. '-1001234567890') */
  telegramChannelId: string;
  /** Google Drive file ID of folder_root.json */
  rootFolderDriveId: string;
  /**
   * File size threshold in bytes.
   * Files ≤ threshold → Google Drive. Files > threshold → Telegram.
   * Default: 20MB (20 * 1024 * 1024)
   */
  sizeThresholdBytes: number;
  /** Default: 500MB — abort upload if Drive would have less than this free */
  safetyBufferBytes: number;
  /** Default: 30 minutes — lock storage after this many minutes of inactivity */
  idleTimeoutMinutes: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// § 8 — BroadcastChannel Protocol
// ═══════════════════════════════════════════════════════════════════════════

export type MetadataOperationType =
  | 'add_file'
  | 'create_folder'
  | 'rename'
  | 'move'
  | 'delete';

export interface MetadataOperation {
  type: MetadataOperationType;
  /** Target folder UUID (or 'root') */
  folderId: string;
  /** Operation-specific payload */
  data: unknown;
}

/**
 * All messages sent over the BroadcastChannel.
 * The `type` field is the discriminant for exhaustive handling.
 *
 * Phase 0 AD-08: BroadcastChannel + leader election serializes all
 * metadata writes across browser tabs to prevent ETag conflicts.
 */
export type BroadcastMessage =
  | {
      type: 'leader_election';
      tabId: string;
      timestamp: number;
    }
  | {
      type: 'leader_announce';
      tabId: string;
    }
  | {
      type: 'leader_heartbeat';
      tabId: string;
      timestamp: number;
    }
  | {
      type: 'leader_abdicate';
      tabId: string;
    }
  | {
      type: 'metadata_write_request';
      tabId: string;
      requestId: string;
      operation: MetadataOperation;
    }
  | {
      type: 'metadata_write_complete';
      requestId: string;
      success: boolean;
      error?: string;
    }
  | {
      type: 'metadata_changed';
      /** Which folder was modified — consumers can invalidate their cached FolderDocument */
      folderId: string;
      newEtag: string;
    }
  | {
      type: 'vault_locked';
      tabId: string;
    };

// ═══════════════════════════════════════════════════════════════════════════
// § 9 — Application State Machine
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Application phase / routing state.
 * The transition graph is:
 *   loading → access_gate → vault_setup → app
 *   loading → vault_unlock → app
 *   loading → compatibility_error (terminal)
 *   app → vault_unlock (idle timeout)
 */
export type AppPhase =
  | 'loading'            // Initial load — checking IndexedDB and Web API availability
  | 'access_gate'        // Uninitialized storage — show TOTP prompt
  | 'vault_setup'        // TOTP passed — create master password + authorize providers
  | 'vault_unlock'       // Returning user — enter master password to unlock
  | 'app'                // Unlocked — main file browser
  | 'compatibility_error'; // Required Web APIs unavailable (terminal state)

export interface AppState {
  phase: AppPhase;
  isVaultInitialized: boolean;
  /** Whether the TOTP gate has been successfully passed in this session */
  isAccessCodeVerified: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// § 10 — TOTP Access Gate
// ═══════════════════════════════════════════════════════════════════════════

export interface TOTPValidationResult {
  valid: boolean;
  /**
   * Reason code for debugging (internal use only — never shown verbatim to user).
   * The UI always shows the same generic error message regardless of fail reason.
   */
  failReason?: 'wrong_code' | 'expired_window' | 'invalid_secret' | 'decode_error';
}

// ═══════════════════════════════════════════════════════════════════════════
// § 11 — VFS Operation Results
// ═══════════════════════════════════════════════════════════════════════════

export interface UploadResult {
  filename: string;
  success: boolean;
  error?: string;
  storageBackend?: StorageBackend;
  /** Drive file ID or Telegram ref — present on success */
  ref?: GoogleDriveRef | TelegramRef;
}

export interface DownloadResult {
  filename: string;
  mimeType: string;
  /** The decrypted file data as a Blob for browser download trigger */
  blob: Blob;
  /** SHA-256 of the downloaded and decrypted file — for user-visible verification */
  sha256?: string;
}

export interface FileSearchResult {
  file: VFSFile;
  /** Folder display names from root to the file's parent (for breadcrumb display) */
  folderPath: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// § 12 — Validation & Error Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ValidationResult {
  valid: boolean;
  violations: string[];
}

export type ErrorCode =
  | 'NETWORK_TIMEOUT'
  | 'NETWORK_RATE_LIMITED'
  | 'AUTH_FAILED'
  | 'OAUTH_ACCESS_DENIED'
  | 'TOKEN_EXPIRED'
  | 'DECRYPTION_FAILED'
  | 'ENCRYPTION_FAILED'
  | 'QUOTA_EXCEEDED'
  | 'SAFETY_BUFFER_BREACHED'
  | 'VALIDATION_FAILED'
  | 'ETAG_MISMATCH'
  | 'HASH_MISMATCH'
  | 'WORKER_CRASHED'
  | 'TOTP_INVALID'
  | 'INDEXEDDB_UNAVAILABLE'
  | 'COMPATIBILITY_ERROR'
  | 'UNKNOWN';

export type ErrorCategory =
  | 'network'
  | 'authentication'
  | 'cryptographic'
  | 'quota'
  | 'validation'
  | 'concurrency'
  | 'compatibility'
  | 'unknown';

export interface AppError {
  code: ErrorCode;
  /** Human-readable message safe to display to the user */
  message: string;
  category: ErrorCategory;
  retryable: boolean;
  /** Structured context for debugging — never shown to user */
  context?: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// § 13 — Type Guards
// ═══════════════════════════════════════════════════════════════════════════

/** Narrow a VFSEntry to VFSFile. */
export function isVFSFile(entry: VFSEntry): entry is VFSFile {
  return entry.type === 'file';
}

/** Narrow a VFSEntry to VFSFolder. */
export function isVFSFolder(entry: VFSEntry): entry is VFSFolder {
  return entry.type === 'folder';
}

/** Narrow a storage ref to GoogleDriveRef. */
export function isGoogleDriveRef(ref: GoogleDriveRef | TelegramRef): ref is GoogleDriveRef {
  return ref.provider === 'google_drive';
}

/** Narrow a storage ref to TelegramRef. */
export function isTelegramRef(ref: GoogleDriveRef | TelegramRef): ref is TelegramRef {
  return ref.provider === 'telegram';
}

/**
 * Validate TelegramRef chunk invariants at runtime.
 * INVARIANT INV-01: totalParts === chunks.length
 * INVARIANT INV-02: chunks[i].partIndex === i for all i
 */
export function validateTelegramRef(ref: TelegramRef): ValidationResult {
  const violations: string[] = [];

  if (ref.totalParts !== ref.chunks.length) {
    violations.push(
      `INV-01 violated: totalParts (${ref.totalParts}) !== chunks.length (${ref.chunks.length})`,
    );
  }

  for (let i = 0; i < ref.chunks.length; i++) {
    if (ref.chunks[i].partIndex !== i) {
      violations.push(
        `INV-02 violated: chunks[${i}].partIndex === ${ref.chunks[i].partIndex}, expected ${i}`,
      );
    }
  }

  return { valid: violations.length === 0, violations };
}

/**
 * Validate a FolderDocument's structural reliability.
 * Used before persisting to Google Drive to prevent corrupt metadata.
 */
export function validateFolderDocument(doc: FolderDocument): ValidationResult {
  const violations: string[] = [];

  if (doc.folderId !== 'root' && doc.parentFolderId === null) {
    violations.push('Non-root folder has null parentFolderId');
  }

  if (doc.folderId === 'root' && doc.parentFolderId !== null) {
    violations.push(`Root folder must have null parentFolderId, got: ${doc.parentFolderId}`);
  }

  if (!doc.etag || doc.etag.trim() === '') {
    violations.push('FolderDocument.etag must not be empty');
  }

  if (!doc.selfDriveId || doc.selfDriveId.trim() === '') {
    violations.push('FolderDocument.selfDriveId must not be empty');
  }

  // Validate TelegramRef chunks for all file entries
  for (const entry of doc.entries) {
    if (isVFSFile(entry) && isTelegramRef(entry.ref)) {
      const refValidation = validateTelegramRef(entry.ref);
      if (!refValidation.valid) {
        violations.push(...refValidation.violations.map((v) => `Entry "${entry.name}": ${v}`));
      }
    }
  }

  return { valid: violations.length === 0, violations };
}
