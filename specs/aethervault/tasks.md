# Implementation Plan: Lukman Cloud

## Overview

This implementation plan breaks down the Lukman Cloud feature into discrete coding tasks. The system is a client-side encrypted multi-cloud storage aggregator (BYOS model) that unifies Google Drive and Telegram storage under a single Virtual File System, running entirely in the browser with React 19, TypeScript, and Web Crypto APIs. Access is controlled by a client-side Access Code Gate and a server-side Google OAuth Testing Mode whitelist.

The implementation follows a bottom-up approach: cryptography and storage foundations first, then metadata management, cloud integrations, multi-tab coordination, and finally the React UI layer.

## Tasks

### 1. Project Setup and Core Infrastructure

- [ ] 1.1 Initialize Vite + React 19 + TypeScript project with strict mode
  - Create project structure: `src/`, `src/components/`, `src/lib/`, `src/types/`, `src/workers/`, `public/`
  - Configure TypeScript with strict mode, target ES2020, lib: DOM, WebWorker, ES2020
  - Configure Vite with support for Web Workers (worker.format: 'es')
  - Install core dependencies: React 19, Tailwind CSS v4, UUID library
  - Install `vite-plugin-node-polyfills` — **MANDATORY** for GramJS browser build (Phase 1 Milestone 1.2 HIGH risk: GramJS uses Node.js `Buffer` globals internally)
  - Configure `nodePolyfills({ include: ['buffer'] })` in vite.config.ts plugins array
  - GramJS (`telegram` npm package) installed but imported ONLY via dynamic `import()` — NEVER statically at module top level. This produces a separate lazy chunk and prevents blocking first paint.
  - Set up Tailwind with Neobrutalism design tokens (3px borders, hard shadows, high contrast)
  - Create environment variable template for Google OAuth Client ID and Telegram API ID/Hash
  - _Requirements: 16.2, 16.3, 16.4, 15.1, 15.2, 15.3_

- [ ] 1.2 Define core TypeScript interfaces and types
  - Create `src/types/index.ts` with all interfaces from the Phase 0 Technical Specification (design.md)
  - Define VFS types (LOCKED schema — use design.md Section 3 as source of truth):
    - `VFSEntryBase`, `VFSFile`, `VFSFolder`, `VFSEntry` (discriminated union)
    - `FolderDocument` (unified `entries: VFSEntry[]` — NOT separate `children[]` + `subfolders[]`)
    - `GoogleDriveRef` (discriminant: `provider: 'google_drive'`)
    - `TelegramRef` (discriminant: `provider: 'telegram'`, fields: `channelId`, `originalFilename`, `sha256Hash`, `totalParts`, `chunks`)
    - `TelegramChunk` (`{ partIndex: number; messageId: number; chunkSize: number }`) — NOT `ChunkReference`
  - Define security types: `SessionState`, `SecurityParams` (salt: Uint8Array 32 bytes), `EncryptedData`
  - Define IndexedDB record types: `SecurityParamsRecord` (salt as ArrayBuffer), `EncryptedCredentialRecord` (iv + ciphertext as ArrayBuffer)
  - Define allocation types: `QuotaInfo`, `StorageBackend`
  - Define BroadcastChannel message types: `BroadcastMessage` union type
  - _Requirements: 3.2, 3.6, 3.7, 14.1, 14.2, 14.3_

- [ ]* 1.3 Write unit tests for TypeScript type guards and validators
  - Test UUID v4 format validation
  - Test FolderDocument schema validation
  - Test storage reference type discrimination
  - _Requirements: 25.4, 25.5_


### 2. Encryption Engine Implementation

- [ ] 2.1 Implement core encryption utilities
  - Create `src/lib/encryption.ts`
  - Implement `generateSecurityParams()`: generate **32-byte (256-bit)** salt using `crypto.getRandomValues(new Uint8Array(32))` — LOCKED: Phase 0 SEC-04. Store as ArrayBuffer in IndexedDB.
  - Implement `deriveKey()`: use PBKDF2 with SHA-256 and provided salt/iterations to derive AES-256-GCM key. MANDATORY: `extractable: false, keyUsages: ['encrypt', 'decrypt']` — Phase 0 SEC-01.
  - Implement `generateIV()`: generate 12-byte (96-bit) IV using `crypto.getRandomValues(new Uint8Array(12))`. Fresh IV for EVERY encryption call.
  - Implement helper functions: `bufferToHex` (for debugging/logging only — never for IndexedDB storage)
  - Do NOT implement or import `crypto-js` or any third-party crypto library. All operations use `window.crypto.subtle` exclusively.
  - _Requirements: 1.1, 1.6, 1.8, 9.2_

- [ ]* 2.2 Write property test for encryption IV uniqueness
  - **Property 2: Encryption IV Uniqueness**
  - **Validates: Requirements 1.8, 9.2, 9.3**
  - Generate 100 encryptions of same data, verify all IVs are unique
  - _Requirements: 1.8, 9.2, 9.3_

- [ ] 2.3 Implement encrypt and decrypt functions
  - Implement `encrypt(data: Uint8Array, key: CryptoKey)`: generate IV, encrypt using AES-256-GCM, return { iv, ciphertext }
  - Implement `decrypt(encryptedData: EncryptedData, key: CryptoKey)`: decrypt using AES-256-GCM, verify authentication tag, return plaintext
  - Handle authentication tag failures by throwing tampering error
  - _Requirements: 1.2, 9.1, 9.5, 9.6, 9.7_

- [ ]* 2.4 Write property test for credential encryption before storage
  - **Property 1: Credential Encryption Before Storage**
  - **Validates: Requirements 1.2, 6.4, 8.3, 14.3**
  - For any credentials object, encrypt then decrypt, verify recovery of original data
  - _Requirements: 1.2, 6.4, 8.3, 14.3_

- [ ] 2.5 Implement streaming encryption and decryption
  - Implement `encryptStream(readable: ReadableStream, key: CryptoKey)`: create TransformStream that encrypts data in 64KB chunks, prepend IV to first chunk
  - Implement `decryptStream(readable: ReadableStream, key: CryptoKey)`: extract IV from first chunk, decrypt subsequent chunks
  - Ensure streaming handles backpressure correctly
  - _Requirements: 9.3, 9.4, 24.1, 24.3_

- [ ]* 2.6 Write unit tests for streaming encryption
  - Test encryption/decryption of 100MB file using streams
  - Verify memory usage stays bounded
  - Test stream error handling and cancellation
  - _Requirements: 24.1, 24.3_

- [ ] 2.7 Implement hash function for integrity verification
  - Implement `hash(data: Uint8Array)`: compute SHA-256 hash, return Uint8Array
  - _Requirements: 7.5, 13.7_


### 3. IndexedDB Storage Layer

- [ ] 3.1 Implement IndexedDB initialization and utilities
  - Create `src/lib/indexeddb.ts`
  - Implement `initDatabase()`: create database **`"aethervault_secure_vault"`** (LOCKED name — Phase 0 Section 2.2) with three object stores:
    - `security_params` (keyPath: 'id') — stores salt as raw `ArrayBuffer`
    - `encrypted_credentials` (keyPath: 'credentialKey') — stores `{ iv: ArrayBuffer, ciphertext: ArrayBuffer }` pairs
    - `settings` (keyPath: 'key') — stores encrypted app config
  - Implement generic CRUD helpers: `getRecord<T>()`, `putRecord<T>()`, `deleteRecord()`
  - Handle database version upgrades
  - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [ ] 3.2 Implement security parameters storage
  - Implement `saveSecurityParams(params: SecurityParams)`: store salt and iterations in security_params store
  - Implement `loadSecurityParams()`: retrieve security params, return null if not found
  - _Requirements: 1.1, 1.7, 14.2_

- [ ] 3.3 Implement encrypted credentials storage
  - Implement `saveCredentials(provider: 'google' | 'telegram', credentials: any, key: CryptoKey)`: encrypt credentials, store in encrypted_credentials store with IV
  - Implement `loadCredentials(provider: 'google' | 'telegram', key: CryptoKey)`: load encrypted credentials, decrypt, return plaintext or null
  - _Requirements: 1.2, 6.4, 8.3, 14.3, 14.4_

- [ ] 3.4 Implement settings storage
  - Implement `saveSettings(settings: AppSettings, key: CryptoKey)`: encrypt settings, store in settings store
  - Implement `loadSettings(key: CryptoKey)`: load and decrypt settings, return default settings if not found
  - Default settings: sizeThreshold 20MB, safetyBuffer 500MB, idleTimeout 30 minutes
  - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

- [ ]* 3.5 Write unit tests for IndexedDB storage layer
  - Test database initialization and upgrades
  - Test security params save/load
  - Test encrypted credentials save/load with correct and incorrect keys
  - Test settings save/load
  - _Requirements: 14.1, 14.2, 14.3, 14.4_


### 4. Session Manager Implementation

- [ ] 4.1 Implement Session Manager core functionality
  - Create `src/lib/session-manager.ts`
  - Implement SessionManager class with closure-isolated state for encryption key
  - Implement `initialize()`: check for security params, load settings
  - Implement `createVault(masterPassword: string)`: generate security params, derive key, save to IndexedDB, transition to unlocked state
  - Implement `unlock(masterPassword: string)`: load security params, derive key, attempt to decrypt credentials, transition to unlocked on success
  - Implement `lock()`: clear encryption key from memory, clear decrypted credentials, transition to locked state
  - Implement `isUnlocked()`: return current lock state
  - Implement `getEncryptionKey()`: return key only if unlocked
  - _Requirements: 1.1, 1.3, 1.4, 2.3, 2.4, 2.5_

- [ ]* 4.2 Write property test for authentication error consistency
  - **Property 3: Authentication Error Consistency**
  - **Validates: Requirements 1.5**
  - For any incorrect password, verify unlock() throws authentication error without revealing credential existence
  - _Requirements: 1.5_

- [ ] 4.3 Implement idle timeout mechanism
  - Implement `resetIdleTimeout()`: clear existing timer, start new 30-minute timer that calls `lock()` on expiration
  - Implement timer cleanup on manual lock
  - _Requirements: 2.1, 2.2, 2.3_

- [ ]* 4.4 Write property test for idle timeout reset
  - **Property 4: Idle Timeout Reset**
  - **Validates: Requirements 2.2**
  - Simulate user interactions, verify timeout continuously resets and vault doesn't lock prematurely
  - _Requirements: 2.2_

- [ ]* 4.5 Write property test for vault lock clears credentials
  - **Property 5: Vault Lock Clears Credentials**
  - **Validates: Requirements 2.4, 2.5, 8.5**
  - After lock (manual or timeout), verify encryption key is null and file operations are blocked
  - _Requirements: 2.4, 2.5, 8.5_

- [ ] 4.6 Integrate idle timeout with UI event listeners
  - Set up global event listeners for mousedown, keydown, touchstart
  - Call `sessionManager.resetIdleTimeout()` on each interaction
  - Clean up listeners on app unmount
  - _Requirements: 2.2_


### 5. Google Drive Client Implementation

- [ ] 5.1 Implement OAuth 2.0 PKCE flow
  - Create `src/lib/drive-client.ts`
  - Implement `generateCodeVerifier()`: generate 128-character random string
  - Implement `computeCodeChallenge(verifier: string)`: compute SHA-256 hash, base64url encode
  - Implement `initiateOAuthFlow()`: build authorization URL with client_id, redirect_uri, scopes (drive.appdata, drive.file), code_challenge, access_type=offline
  - Implement `handleOAuthCallback(code: string, codeVerifier: string)`: exchange authorization code for access token and refresh token
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 5.2 Implement token management and storage
  - Implement `saveTokens(accessToken: string, refreshToken: string, expiresIn: number, encryptionKey: CryptoKey)`: encrypt tokens, store in IndexedDB
  - Implement `loadTokens(encryptionKey: CryptoKey)`: load and decrypt tokens
  - Implement `refreshAccessToken()`: use refresh token to get new access token, update stored credentials
  - Implement automatic token refresh on 401 responses
  - _Requirements: 6.4, 6.5_

- [ ] 5.3 Implement Drive API quota queries
  - Implement `getQuota()`: call Drive API `about.get` with fields=storageQuota, return QuotaInfo
  - Parse total, used, and available from response
  - _Requirements: 5.4, 15.7_

- [ ] 5.4 Implement Drive file upload with streaming
  - Implement `uploadFile(stream: ReadableStream, filename: string)`: use Drive API resumable upload protocol
  - Start resumable session, upload stream in chunks, handle backpressure
  - Compute MD5 checksum during upload (using incremental hashing)
  - Return DriveFileRef with fileId and md5
  - _Requirements: 6.7, 6.8_

- [ ] 5.5 Implement Drive file download with verification
  - Implement `downloadFile(fileId: string)`: fetch file content as ReadableStream
  - Implement `verifyChecksum(fileId: string, expectedMd5: string)`: get file metadata, compare MD5
  - _Requirements: 6.9_

- [ ] 5.6 Implement Drive appDataFolder metadata operations
  - Implement `uploadMetadata(folderId: string, doc: FolderDocument, etag?: string)`: upload folder document JSON to appDataFolder with filename `folder_<folderId>.json`
  - Include If-Match header with etag for optimistic locking
  - Return new etag from response
  - Implement `downloadMetadata(folderId: string)`: download folder document from appDataFolder, return doc and etag from response headers
  - _Requirements: 3.1, 3.4, 6.6_

- [ ] 5.7 Implement ETag-based optimistic locking with retry
  - Implement retry logic in metadata uploads: on 412 Precondition Failed, fetch latest version, merge changes, retry (max 3 attempts)
  - _Requirements: 3.4, 3.5_

- [ ]* 5.8 Write unit tests for Drive client
  - Test PKCE code verifier and challenge generation
  - Test token encryption and storage
  - Test token refresh logic
  - Mock Drive API responses for quota, upload, download, metadata operations
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_


### 6. Telegram Client and Multi-Chunking Engine

- [ ] 6.1 Install and configure GramJS library
  - Install GramJS for MTProto WebSocket communication
  - Create Telegram client configuration with API credentials
  - _Requirements: 7.1_

- [ ] 6.2 Create Telegram Web Worker
  - Create `src/workers/telegram-worker.ts`
  - Set up message passing protocol between main thread and worker
  - Initialize GramJS client in worker context
  - _Requirements: 7.2, 24.2_

- [ ] 6.3 Implement Telegram authentication in worker
  - Implement phone number authentication with 2FA support
  - Implement bot token authentication
  - Encrypt and persist session string to IndexedDB
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 6.4 Implement multi-chunking upload logic in worker
  - Implement `chunkAndUpload(file: File, channelId: string)`: split file into 2GB chunks (CHUNK_SIZE = 2 * 1024 * 1024 * 1024)
  - BEFORE chunking: compute SHA-256 of the COMPLETE original file using `crypto.subtle.digest('SHA-256', fileBuffer)`. This whole-file hash is stored in `TelegramRef.sha256Hash`.
  - For each chunk: upload as message to channel with caption `chunk_<partIndex>_<filename>`
  - Return `TelegramRef` with: `{ provider: 'telegram', channelId, originalFilename, sha256Hash, totalParts: chunks.length, chunks: [{ partIndex, messageId, chunkSize }, ...] }`
  - INVARIANT: `chunks[i].partIndex === i` for all i. Validate before returning.
  - _Requirements: 7.3, 7.4, 7.5, 7.6_

- [ ]* 6.5 Write property test for Telegram chunk integrity
  - **Property 9 (partial): Storage Reference Completeness**
  - **Validates: Requirements 3.7, 13.5, 13.7**
  - For any uploaded file, verify TelegramRef has non-empty channelId, chunks array, and each chunk has messageId and sha256
  - _Requirements: 3.7, 13.5, 13.7_

- [ ] 6.6 Implement multi-chunk download and reassembly in worker
  - Implement `downloadAndReassemble(ref: TelegramRef, channelId: string)`: download chunks in sequential `partIndex` order
  - Concatenate all chunk `Uint8Array` buffers in order
  - Compute SHA-256 of the COMPLETE reassembled buffer
  - Compare against `TelegramRef.sha256Hash` — if mismatch throw `FILE_INTEGRITY_ERROR`
  - On hash match, return the reassembled data as a `Uint8Array`
  - _Requirements: 7.7, 7.8, 7.9, 7.10_

- [ ] 6.7 Implement main thread Telegram client wrapper
  - Create `src/lib/telegram-client.ts` that communicates with worker
  - Implement `uploadFile(stream: ReadableStream, filename: string)`: convert stream to File, send to worker, await TelegramFileRef
  - Implement `downloadFile(ref: TelegramRef)`: request from worker, return ReadableStream
  - Implement `setStorageChannel(channelId: string)`, `getChannelInfo(channelId: string)`, `deleteMessages(channelId, messageIds)`
  - _Requirements: 7.1, 7.2_

- [ ]* 6.8 Write unit tests for Telegram client
  - Test chunking logic with files of various sizes (1GB, 3GB, 5GB)
  - Test chunk verification and retry logic
  - Test worker communication protocol
  - _Requirements: 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_


### 7. Storage Router Implementation

- [ ] 7.1 Implement Storage Router with routing logic
  - Create `src/lib/storage-router.ts`
  - Implement `determineStorage(fileSize: number)`: query Drive quota, apply routing algorithm from design
  - If forcedBackend set, return it immediately
  - If fileSize >= 20MB, return 'telegram'
  - If (available - fileSize) < safetyBuffer, return 'telegram'
  - Otherwise return 'gdrive'
  - Implement `forceStorage(backend: StorageBackend)` and `resetToAutomatic()`
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ]* 7.2 Write property test for small file routing to Drive
  - **Property 13: Small File Routing to Drive**
  - **Validates: Requirements 5.1**
  - For files <20MB with sufficient quota, verify routing to Google Drive
  - _Requirements: 5.1_

- [ ]* 7.3 Write property test for large file routing to Telegram
  - **Property 14: Large File Routing to Telegram**
  - **Validates: Requirements 5.3**
  - For files >=20MB, verify routing to Telegram regardless of quota
  - _Requirements: 5.3_

- [ ]* 7.4 Write property test for quota-based routing
  - **Property 15: Quota-Based Routing to Telegram**
  - **Validates: Requirements 5.2, 5.5**
  - When quota insufficient (available < fileSize + safetyBuffer), verify routing to Telegram
  - _Requirements: 5.2, 5.5_

- [ ]* 7.5 Write property test for manual storage override
  - **Property 17: Manual Storage Override**
  - **Validates: Requirements 5.6**
  - When forceStorage() called, verify all files route to forced backend
  - _Requirements: 5.6_


### 8. Metadata Manager Implementation

- [ ] 8.1 Implement Metadata Manager core functionality
  - Create `src/lib/metadata-manager.ts`
  - Implement `initializeRoot()`: create root FolderDocument with id, name="Root", parentId=null, empty children and subfolders arrays, upload to Drive appDataFolder
  - Implement in-memory cache for loaded FolderDocuments with LRU eviction (max 50 folders)
  - _Requirements: 3.1, 3.2, 18.8_

- [ ] 8.2 Implement folder retrieval and caching
  - Implement `getFolder(folderId: string)`: check cache, if miss load from Drive, decrypt if needed, validate schema, cache and return
  - Implement `listFolder(folderId: string)`: same as getFolder
  - _Requirements: 3.1, 10.1_

- [ ] 8.3 Implement folder operations
  - Implement `createFolder(parentId: string, name: string)`: generate UUID, create FolderDocument, upload to Drive, update parent's subfolders array
  - Implement `rename(itemId: string, newName: string, isFolder: boolean)`: load folder, update name or child name, save back
  - Implement `move(itemId: string, newParentId: string, isFolder: boolean)`: update old parent (remove reference), update new parent (add reference), update item's parentId if folder
  - Implement `delete(itemId: string, isFolder: boolean)`: recursive deletion for folders, update parent folder, remove from Drive
  - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [ ]* 8.4 Write property test for FolderDocument schema completeness
  - **Property 7: FolderDocument Schema Completeness**
  - **Validates: Requirements 3.2**
  - For any created folder, verify all required fields present and correctly typed
  - _Requirements: 3.2_

- [ ]* 8.5 Write property test for metadata update isolation
  - **Property 8: Metadata Update Isolation**
  - **Validates: Requirements 3.3, 10.7**
  - When file added to folder A, verify folder B unchanged
  - _Requirements: 3.3, 10.7_

- [ ] 8.6 Implement file operations
  - Implement `addFile(folderId: string, fileEntry: FileEntry)`: load folder, append to children, save back with ETag locking
  - Validate FileEntry schema before adding
  - _Requirements: 3.3, 11.6_

- [ ]* 8.7 Write property test for storage reference completeness
  - **Property 9: Storage Reference Completeness**
  - **Validates: Requirements 3.6, 3.7, 13.4, 13.5, 13.7**
  - For any file, verify GoogleDriveRef has fileId and md5, or TelegramRef has channelId and non-empty chunks array
  - _Requirements: 3.6, 3.7, 13.4, 13.5, 13.7_

- [ ] 8.8 Implement file search
  - Implement `searchFiles(query: string)`: traverse all cached folders, filter by case-insensitive partial name match, return results with folder paths
  - _Requirements: 20.1, 20.2, 20.3_

- [ ] 8.9 Implement metadata validation
  - Implement `validateIntegrity()`: traverse metadata tree, check invariants INV-01 through INV-08 from requirements
  - Return ValidationResult with list of violations
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 25.4, 25.5_

- [ ]* 8.10 Write unit tests for metadata manager
  - Test folder creation, rename, move, delete
  - Test file addition and search
  - Test cache behavior
  - Test schema validation
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_


### 9. Multi-Tab Coordination with BroadcastChannel

- [ ] 9.1 Implement BroadcastChannel leader election
  - Create `src/lib/broadcast-coordinator.ts`
  - Implement leader election: on startup, broadcast leader_election with tabId and timestamp, wait 100ms, elect tab with lowest timestamp
  - Implement heartbeat: leader sends heartbeat every 5 seconds, non-leaders detect absence and trigger re-election
  - Implement `isLeader()` method
  - _Requirements: 4.1, 4.3_

- [ ]* 9.2 Write property test for leader election uniqueness
  - **Property 10: Leader Election Uniqueness**
  - **Validates: Requirements 4.1**
  - Simulate multiple tabs, verify exactly one leader elected
  - _Requirements: 4.1_

- [ ] 9.3 Implement metadata write serialization
  - Implement `requestMetadataWrite(operation: MetadataOperation)`: if leader, execute immediately; if non-leader, broadcast metadata_write_request, await metadata_write_complete response
  - Leader handles incoming write requests by executing them and broadcasting completion
  - _Requirements: 4.2, 4.4_

- [ ]* 9.4 Write property test for metadata write serialization
  - **Property 11: Metadata Write Serialization**
  - **Validates: Requirements 4.2, 4.4**
  - Simulate non-leader tab write, verify routed through leader
  - _Requirements: 4.2, 4.4_

- [ ] 9.5 Implement metadata change broadcasting
  - Implement `broadcastMetadataChange(folderId: string)`: send metadata_changed message to all tabs
  - Implement listener for metadata_changed: invalidate cache, trigger UI refresh
  - _Requirements: 4.5, 4.6_

- [ ]* 9.6 Write property test for metadata change broadcast
  - **Property 12: Metadata Change Broadcast**
  - **Validates: Requirements 4.5, 4.6**
  - Simulate metadata change in one tab, verify all tabs receive notification
  - _Requirements: 4.5, 4.6_

- [ ] 9.7 Implement vault lock broadcasting
  - Implement `broadcastVaultLock()`: send vault_locked message to all tabs
  - Implement listener for vault_locked: call sessionManager.lock() in receiving tabs
  - _Requirements: 2.5_

- [ ]* 9.8 Write unit tests for BroadcastChannel coordination
  - Test leader election with simulated tabs
  - Test write serialization
  - Test change broadcasting
  - Test vault lock propagation
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_


### 10. Virtual File System (VFS) Layer

- [ ] 10.1 Implement VFS initialization and navigation
  - Create `src/lib/vfs.ts`
  - Implement `initialize()`: initialize all dependent components (SessionManager, MetadataManager, DriveClient, TelegramClient, BroadcastCoordinator)
  - Implement `navigateToFolder(folderId: string)`: load folder via MetadataManager, set as current folder
  - Implement `getCurrentFolder()`: return current folder or null
  - Implement `getBreadcrumbPath(folderId: string)`: traverse parent references to root, return path array
  - _Requirements: 10.1_

- [ ] 10.2 Implement VFS folder operations
  - Implement `createFolder(name: string, parentId: string)`: validate name (no path traversal), call MetadataManager.createFolder, broadcast change
  - Implement `renameItem(itemId, newName, isFolder)`: validate name, call MetadataManager.rename, broadcast change
  - Implement `moveItem(itemId, newParentId, isFolder)`: call MetadataManager.move, broadcast change
  - Implement `deleteItem(itemId, isFolder)`: call MetadataManager.delete (recursive), broadcast change
  - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6, 25.1, 25.2_

- [ ] 10.3 Implement VFS file upload pipeline
  - Implement `uploadFiles(files: File[], folderId: string)`: validate filenames, limit to 3 concurrent uploads
  - For each file:
    - Create ReadableStream from File
    - Encrypt stream using EncryptionEngine.encryptStream()
    - Query StorageRouter.determineStorage()
    - Upload to determined backend (DriveClient or TelegramClient)
    - Create FileEntry with storage reference
    - Call MetadataManager.addFile()
    - Broadcast metadata change
  - Return UploadResult array
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 24.4_

- [ ]* 10.4 Write property test for file operations require unlock
  - **Property 6: File Operations Require Unlock**
  - **Validates: Requirements 2.6**
  - Attempt file operations while vault locked, verify all blocked
  - _Requirements: 2.6_

- [ ] 10.5 Implement VFS file download pipeline
  - Implement `downloadFile(fileId: string)`: get FileEntry from MetadataManager
  - Determine backend from storageRef.type
  - Download from backend (DriveClient or TelegramClient) as ReadableStream
  - Decrypt stream using EncryptionEngine.decryptStream()
  - Verify integrity (MD5 for Drive, SHA-256 for Telegram)
  - Create Blob from decrypted stream
  - Trigger browser download using createObjectURL
  - Release Blob URL after download starts
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 24.1, 24.6_

- [ ] 10.6 Implement VFS search
  - Implement `searchFiles(query: string)`: call MetadataManager.searchFiles, return results
  - _Requirements: 20.1, 20.2, 20.3_

- [ ] 10.7 Implement upload/download progress tracking
  - Emit progress events during streaming operations
  - Track bytes transferred, calculate percentage
  - For Telegram multi-chunk files, aggregate progress across chunks
  - _Requirements: 11.5, 12.2, 12.6_

- [ ]* 10.8 Write integration tests for VFS
  - Test complete upload pipeline with mock backends
  - Test complete download pipeline with mock backends
  - Test folder operations
  - Test search
  - Test concurrent upload limits
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 12.1, 12.2, 12.3, 12.4, 24.4, 24.5_


### 11. React UI Components - Authentication and Vault

- [ ] 11.1 Create vault initialization flow UI
  - Create `src/components/VaultSetup.tsx`
  - Implement master password creation form with:
    - Password input (min 12 characters, mixed case, numbers)
    - Password confirmation input
    - Password strength indicator (use zxcvbn or similar)
    - Submit button
  - Call SessionManager.createVault() on submit
  - Navigate to provider authentication on success
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 25.3_

- [ ] 11.2 Create OAuth provider authentication UI
  - Create `src/components/ProviderAuth.tsx`
  - Implement Google Drive authentication button: trigger DriveClient.authenticate(), handle OAuth callback
  - Implement Telegram authentication form: phone number or bot token input, handle 2FA code if needed
  - Show authentication status (pending, success, error)
  - Proceed to main app when both providers authenticated
  - _Requirements: 18.5, 18.6, 18.7_

- [ ] 11.3 Create vault unlock UI
  - Create `src/components/VaultUnlock.tsx`
  - Implement password input form
  - Call SessionManager.unlock() on submit
  - Display authentication errors clearly
  - Navigate to main app on successful unlock
  - _Requirements: 1.3, 1.5, 17.2_

- [ ] 11.4 Create vault lock button and status indicator
  - Create `src/components/VaultStatus.tsx`
  - Display lock icon with unlock status
  - Implement manual lock button calling SessionManager.lock()
  - Display idle timeout countdown (optional enhancement)
  - _Requirements: 2.5, 15.6_

- [ ]* 11.5 Write component tests for authentication UI
  - Test vault setup form validation
  - Test provider authentication flows
  - Test unlock form with correct/incorrect passwords
  - Test vault lock button
  - _Requirements: 18.1, 18.2, 18.3, 1.3, 1.5, 2.5_


### 12. React UI Components - File Browser

- [ ] 12.1 Create folder navigation and breadcrumb UI
  - Create `src/components/FolderNavigator.tsx`
  - Display breadcrumb trail from root to current folder
  - Implement clickable breadcrumb items to navigate up hierarchy
  - Display current folder name prominently
  - _Requirements: 10.1, 15.5_

- [ ] 12.2 Create file and folder list UI
  - Create `src/components/FileList.tsx`
  - Display folders and files in current folder
  - Show folder icon, file type icon, name, size (human-readable), upload date, storage backend indicator (Drive/Telegram badge)
  - Implement sorting by name, size, date
  - Implement folder double-click to navigate
  - _Requirements: 10.1, 22.1, 22.2, 22.3, 22.4, 22.5_

- [ ] 12.3 Create file/folder context menu and actions
  - Create `src/components/ItemContextMenu.tsx`
  - Implement right-click context menu with: Download, Rename, Move, Delete
  - Implement action handlers calling VFS methods
  - Show confirmation dialogs for destructive actions
  - _Requirements: 10.3, 10.4, 10.5, 10.6, 12.1_

- [ ] 12.4 Create folder creation UI
  - Create `src/components/CreateFolder.tsx`
  - Implement "New Folder" button in toolbar
  - Show modal with folder name input
  - Validate folder name (no path traversal, no invalid chars)
  - Call VFS.createFolder() on submit
  - _Requirements: 10.2, 25.1, 25.2_

- [ ] 12.5 Create file upload UI with progress
  - Create `src/components/FileUpload.tsx`
  - Implement file input (hidden) with "Upload Files" button trigger
  - Support multiple file selection and drag-and-drop
  - Display upload queue with progress bars per file
  - Show upload status: pending, uploading, complete, error
  - Display storage backend selected for each file
  - Implement retry button for failed uploads
  - _Requirements: 11.1, 11.5, 11.7_

- [ ] 12.6 Create file download UI with progress
  - Implement download action in context menu
  - Show download progress bar in notification or status area
  - Display error messages on download failure with retry option
  - _Requirements: 12.2, 12.4, 12.5, 17.5_

- [ ]* 12.7 Write component tests for file browser UI
  - Test folder navigation and breadcrumbs
  - Test file list rendering
  - Test context menu actions
  - Test folder creation
  - Test file upload queue and progress
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.5, 12.2_


### 13. React UI Components - Search and Settings

- [ ] 13.1 Create file search UI
  - Create `src/components/FileSearch.tsx`
  - Implement search input in app header
  - Trigger VFS.searchFiles() on input change (debounced 300ms)
  - Display search results with folder path for each file
  - Highlight matching text in results
  - Clear search to return to folder view
  - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_

- [ ] 13.2 Create settings panel UI
  - Create `src/components/Settings.tsx`
  - Implement settings modal with sections:
    - Storage preferences: size threshold slider (10-100MB), safety buffer slider (100-1000MB)
    - Security: idle timeout dropdown (15/30/60 minutes)
    - Telegram: channel ID input
    - Provider re-authentication buttons
    - Vault reset button (with confirmation)
  - Load settings from IndexedDB on mount
  - Save settings on change, encrypt before storage
  - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 21.1_

- [ ] 13.3 Create quota and status display UI
  - Create `src/components/StatusBar.tsx`
  - Display Google Drive quota: used / total (with percentage bar)
  - Display Telegram connection status (connected/disconnected)
  - Update quota after each upload
  - _Requirements: 15.7_

- [ ] 13.4 Create vault reset flow UI
  - In Settings component, implement vault reset button
  - Show confirmation modal requiring master password re-entry
  - Call SessionManager.lock(), clear IndexedDB
  - Display instructions to revoke OAuth permissions manually
  - Redirect to vault initialization flow
  - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7_

- [ ]* 13.5 Write component tests for search and settings UI
  - Test search input and results display
  - Test settings form validation and persistence
  - Test vault reset confirmation flow
  - Test quota display updates
  - _Requirements: 20.1, 20.2, 20.3, 19.1, 19.2, 19.3, 21.1, 21.2_


### 14. Error Handling and User Feedback

- [ ] 14.1 Implement global error handling
  - Create `src/lib/error-handler.ts`
  - Define error types: NetworkError, AuthenticationError, DecryptionError, QuotaError, OperationError
  - Implement error classifier to map exceptions to user-friendly messages
  - Implement error logging to console with detailed context
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

- [ ] 14.2 Create error notification UI component
  - Create `src/components/ErrorNotification.tsx`
  - Display error messages as dismissible toast notifications
  - Show error type icon, message, and optional retry button
  - Support stacking multiple errors
  - Auto-dismiss after 10 seconds (configurable)
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [ ] 14.3 Integrate error handling in VFS operations
  - Wrap all VFS operations in try-catch blocks
  - Classify exceptions using error handler
  - Display user-friendly error notifications
  - Implement retry logic for transient errors (network, quota)
  - _Requirements: 11.7, 12.5, 17.1, 17.2, 17.3, 17.4, 17.5_

- [ ] 14.4 Implement browser compatibility checks
  - Create `src/lib/compatibility.ts`
  - Check for SubtleCrypto, IndexedDB, BroadcastChannel API availability
  - Display compatibility error modal if required APIs missing
  - List supported browsers and versions
  - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7_

- [ ]* 14.5 Write tests for error handling
  - Test error classification and message generation
  - Test error notification UI rendering and dismissal
  - Test retry logic for different error types
  - Test compatibility checks
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 23.4, 23.5, 23.6, 23.7_


### 15. Main Application Integration

- [ ] 15.1 Create main App component with routing
  - Create `src/App.tsx`
  - Implement client-side routing using React Router or similar
  - Define routes: /setup, /unlock, /app, /oauth-callback
  - Implement route guards: redirect to /unlock if vault locked, redirect to /setup if no security params
  - _Requirements: 16.1, 16.2_

- [ ] 15.2 Initialize application state and context
  - Create React Context for VFS, SessionManager, and global state
  - Initialize all services on app mount
  - Check for existing security params to determine initial route
  - Handle OAuth callback route to complete Drive authentication
  - _Requirements: 16.1, 16.2, 18.1_

- [ ] 15.3 Implement main application layout
  - Create `src/components/Layout.tsx`
  - Implement app shell with:
    - Header: logo, search bar, vault status, settings button
    - Sidebar: navigation, storage quota display
    - Main content area: file browser
    - Status bar: Telegram connection status
  - Apply Neobrutalism styling consistently
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

- [ ] 15.4 Wire up all UI components with VFS
  - Connect FileUpload component to VFS.uploadFiles()
  - Connect FileList component to VFS.getCurrentFolder()
  - Connect FolderNavigator to VFS.navigateToFolder()
  - Connect CreateFolder to VFS.createFolder()
  - Connect ItemContextMenu actions to VFS methods
  - Connect FileSearch to VFS.searchFiles()
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 11.1, 12.1, 20.1_

- [ ] 15.5 Implement responsive design and mobile optimization
  - Ensure all components responsive using Tailwind breakpoints
  - Optimize touch interactions for mobile devices
  - Test on various screen sizes
  - _Requirements: 15.4_

- [ ]* 15.6 Write end-to-end integration tests
  - Test complete vault creation flow
  - Test provider authentication flows
  - Test vault unlock/lock cycle
  - Test file upload, download, search end-to-end
  - Test multi-tab coordination behavior
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8_


### 16. Deployment and Production Readiness

- [ ] 16.1 Configure Vite for production build
  - Optimize bundle splitting for code-splitting
  - Configure compression (gzip/brotli)
  - Set up environment variables for production (Google OAuth Client ID, Telegram API credentials)
  - Configure CSP headers in vercel.json
  - _Requirements: 16.1, 16.5_

- [ ] 16.2 Set up Vercel deployment
  - Create vercel.json configuration for static site
  - Configure build command and output directory
  - Set up environment variables in Vercel dashboard
  - Configure custom domain (optional)
  - _Requirements: 16.1, 16.5_

- [ ] 16.3 Implement XSS protection and input sanitization
  - Use DOMPurify or similar library for sanitizing user inputs before rendering
  - Validate all user-provided strings (folder names, file names, search queries)
  - Implement CSP headers to restrict script sources
  - _Requirements: 25.6_

- [ ] 16.4 Performance optimization pass
  - Implement React.memo for expensive components
  - Use React.lazy for code-splitting routes
  - Optimize re-renders using useCallback and useMemo
  - Profile and optimize streaming operations
  - Test with large files (>1GB) to ensure memory stays bounded
  - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6_

- [ ] 16.5 Security audit and testing
  - Review all cryptographic operations for correctness
  - Test PBKDF2 iteration performance across devices
  - Verify encryption keys never logged or serialized
  - Test token refresh and re-authentication flows
  - Verify file integrity checks work correctly
  - _Requirements: 1.1, 1.2, 1.4, 1.6, 6.5, 6.8, 6.9, 7.5, 7.8, 7.9_

- [ ] 16.6 Browser compatibility testing
  - Test in Chrome, Edge, Brave (Chromium-based)
  - Test in Firefox
  - Test in Safari
  - Verify all Web APIs available and functioning
  - Document any browser-specific issues or workarounds
  - _Requirements: 23.1, 23.2, 23.3_

- [ ] 16.7 Create user documentation
  - Write README.md with setup instructions
  - Document vault initialization process
  - Document provider authentication requirements
  - Document security model and limitations
  - Document browser requirements
  - _Requirements: 16.1, 18.1, 23.1, 23.2, 23.3_

- [ ] 16.8 Final checkpoint - Ensure all tests pass
  - Run all unit tests, property tests, integration tests, end-to-end tests
  - Verify production build succeeds
  - Deploy to Vercel staging environment
  - Perform manual smoke testing
  - Ask the user if questions arise.


## Notes

- Tasks marked with `*` are optional test-related tasks and can be skipped for faster MVP development
- Each task references specific requirements for traceability
- Property-based tests validate universal correctness properties defined in the design document
- Unit tests and integration tests validate specific examples and edge cases
- The implementation follows a bottom-up approach: foundations first (encryption, storage), then integrations (Drive, Telegram), then orchestration (VFS, BroadcastChannel), finally UI (React components)
- Checkpoints ensure incremental validation and provide opportunities for user feedback
- The TypeScript strict mode configuration enforces type safety throughout the codebase
- All cryptographic operations use Web Crypto API for security and browser compatibility
- Streaming architecture ensures large files can be processed without memory exhaustion
- Multi-tab coordination ensures metadata consistency across concurrent browser sessions
- The Neobrutalism design system provides a distinctive visual identity with 3px borders, hard shadows, and high contrast
- Access control uses a two-layer defense: client-side VITE_APP_ACCESS_CODE gate + server-side Google OAuth Testing Mode whitelist
- The BYOS model ensures zero shared backend: each user's vault is backed by their own Google Drive and Telegram accounts

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1.1", "1.2"]
    },
    {
      "id": 1,
      "tasks": ["1.3", "2.1"]
    },
    {
      "id": 2,
      "tasks": ["2.2", "2.3", "2.7", "3.1"]
    },
    {
      "id": 3,
      "tasks": ["2.4", "2.5", "3.2", "3.3", "3.4"]
    },
    {
      "id": 4,
      "tasks": ["2.6", "3.5", "4.1"]
    },
    {
      "id": 5,
      "tasks": ["4.2", "4.3", "4.6"]
    },
    {
      "id": 6,
      "tasks": ["4.4", "4.5", "5.1"]
    },
    {
      "id": 7,
      "tasks": ["5.2", "5.3", "6.1"]
    },
    {
      "id": 8,
      "tasks": ["5.4", "5.5", "6.2", "6.3"]
    },
    {
      "id": 9,
      "tasks": ["5.6", "6.4"]
    },
    {
      "id": 10,
      "tasks": ["5.7", "5.8", "6.5", "6.6"]
    },
    {
      "id": 11,
      "tasks": ["6.7", "7.1"]
    },
    {
      "id": 12,
      "tasks": ["6.8", "7.2", "7.3", "7.4", "7.5", "8.1"]
    },
    {
      "id": 13,
      "tasks": ["8.2", "8.3"]
    },
    {
      "id": 14,
      "tasks": ["8.4", "8.5", "8.6"]
    },
    {
      "id": 15,
      "tasks": ["8.7", "8.8", "8.9", "9.1"]
    },
    {
      "id": 16,
      "tasks": ["8.10", "9.2", "9.3"]
    },
    {
      "id": 17,
      "tasks": ["9.4", "9.5"]
    },
    {
      "id": 18,
      "tasks": ["9.6", "9.7", "10.1"]
    },
    {
      "id": 19,
      "tasks": ["9.8", "10.2", "10.3"]
    },
    {
      "id": 20,
      "tasks": ["10.4", "10.5", "10.6", "10.7"]
    },
    {
      "id": 21,
      "tasks": ["10.8", "11.1"]
    },
    {
      "id": 22,
      "tasks": ["11.2", "11.3", "11.4"]
    },
    {
      "id": 23,
      "tasks": ["11.5", "12.1", "12.2"]
    },
    {
      "id": 24,
      "tasks": ["12.3", "12.4", "12.5", "12.6"]
    },
    {
      "id": 25,
      "tasks": ["12.7", "13.1", "13.2", "13.3"]
    },
    {
      "id": 26,
      "tasks": ["13.4", "13.5", "14.1"]
    },
    {
      "id": 27,
      "tasks": ["14.2", "14.3", "14.4"]
    },
    {
      "id": 28,
      "tasks": ["14.5", "15.1"]
    },
    {
      "id": 29,
      "tasks": ["15.2", "15.3"]
    },
    {
      "id": 30,
      "tasks": ["15.4", "15.5"]
    },
    {
      "id": 31,
      "tasks": ["15.6", "16.1"]
    },
    {
      "id": 32,
      "tasks": ["16.2", "16.3", "16.4"]
    },
    {
      "id": 33,
      "tasks": ["16.5", "16.6", "16.7"]
    },
    {
      "id": 34,
      "tasks": ["16.8"]
    }
  ]
}
```


### 17. Access Control & Multi-User Architecture

- [ ] 17.1 Implement compile-time TOTP secret configuration
  - Add `VITE_APP_TOTP_SECRET` (Base32 seed) and `VITE_APP_TOTP_PERIOD` (default: 300) to `.env.example` with documentation
  - Add `VITE_APP_TOTP_SECRET` and `VITE_APP_TOTP_PERIOD` to `src/vite-env.d.ts` `ImportMetaEnv` interface
  - Document in README: this variable MUST be set in Vercel dashboard before deployment; must match the secret entered in your authenticator app
  - Add a build-time validation warning if `VITE_APP_TOTP_SECRET` is empty or undefined
  - _Requirements: 26.1_

- [ ] 17.2 Implement Access Code Gate component
  - Create `src/components/AccessCodeGate.tsx`
  - Implement 6-digit TOTP input form (numeric keyboard, auto-submit on 6 digits)
  - Call `validateTOTP(enteredCode)` from `src/lib/totp.ts` (implemented in Task 17.7)
  - On failure: display error "Invalid or expired code. Please ask Lukman for a fresh code." Hard-block vault creation.
  - On success: dispatch event/callback to proceed to VaultSetup
  - Apply Neobrutalism styling (3px borders, hard drop-shadow, mono font for digit input)
  - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6, 26.9_

- [ ] 17.3 Integrate Access Code Gate into application routing
  - Modify route guard logic in `src/App.tsx`:
    - IF no IndexedDB security_params: show AccessCodeGate → (on success) show VaultSetup
    - IF IndexedDB security_params exists: show VaultUnlock directly (skip gate entirely)
  - Gate state is purely in-memory (React state); cleared on page refresh
  - _Requirements: 26.6, 26.7, 26.8_

- [ ] 17.4 Implement unauthorized OAuth error handling
  - In `src/lib/drive-client.ts` OAuth callback handler, detect `error=access_denied` from Google
  - Map to user-friendly modal message: "Your Google account is not authorized for Lukman Cloud. Please contact the administrator to be added to the approved list."
  - Use a modal dialog (not a toast) since this requires explicit user action
  - _Requirements: 27.3_

- [ ] 17.5 Create access control documentation
  - Add `docs/ACCESS_CONTROL.md` with:
    - How to generate a TOTP secret (Base32) and set `VITE_APP_TOTP_SECRET` in Vercel dashboard
    - Which authenticator apps support custom periods (Aegis, andOTP, 1Password, Bitwarden)
    - How to configure the TOTP secret in your authenticator app (manual entry with algorithm=SHA1, digits=6, period=300)
    - How to share a valid code with a family member (just open authenticator app and read the current code)
    - How to add a new family member to Google Cloud Console test users
    - How to remove/revoke access (remove from test users + note about token expiry)
    - Complete onboarding flow for a new trusted user (end-to-end)
  - _Requirements: 26.10, 27.4_

- [ ]* 17.6 Write tests for TOTP Access Code Gate
  - Test: gate shown when vault is uninitialized (no security_params)
  - Test: gate NOT shown when vault is initialized (returning user)
  - Test: valid TOTP code (mocked current window) transitions to VaultSetup
  - Test: valid TOTP code from previous window (clock drift) transitions to VaultSetup
  - Test: expired code (two windows past) is rejected
  - Test: wrong code (correct format, wrong value) blocks vault creation
  - Test: unauthorized OAuth error displays correct modal message
  - _Requirements: 26.2, 26.4, 26.5, 26.6, 26.7, 26.9, 27.3_

- [ ] 17.7 Implement zero-dependency client-side TOTP validation library
  - Create `src/lib/totp.ts` — pure browser-native implementation, NO npm dependencies
  - Implement `base32Decode(secret: string): Uint8Array` — RFC 4648 Base32 decoder, handles standard Base32 alphabet (A-Z, 2-7), strips spaces and converts to lowercase
  - Implement `computeHOTP(key: ArrayBuffer, counter: bigint): Promise<string>` using `crypto.subtle.sign('HMAC', ...)` with SHA-1 hash:
    - Encode counter as 8-byte big-endian `ArrayBuffer`
    - Run HMAC-SHA-1 via `SubtleCrypto.sign`
    - Apply RFC 4226 dynamic truncation (offset = hmac[19] & 0x0f)
    - Extract 31-bit integer starting at offset
    - Compute `otp = truncated % 1_000_000`, pad to 6 digits
  - Implement `validateTOTP(enteredCode: string): Promise<TOTPValidationResult>` which:
    - Reads `import.meta.env.VITE_APP_TOTP_SECRET` and `import.meta.env.VITE_APP_TOTP_PERIOD` (default 300)
    - Computes `counter = Math.floor(Date.now() / 1000 / period)` for CURRENT window
    - Computes `counter - 1` for PREVIOUS window (±1 window drift tolerance per Req 26.4)
    - Returns `{ valid: true }` if enteredCode matches either window
    - Returns `{ valid: false, failReason: 'wrong_code' }` otherwise
    - Never throws — wraps all errors and returns `{ valid: false, failReason: 'invalid_secret' }`
  - _Requirements: 26.3, 26.4, 26.5_


## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.7", "3.1"] },
    { "id": 3, "tasks": ["2.4", "2.5", "3.2", "3.3", "3.4"] },
    { "id": 4, "tasks": ["2.6", "3.5", "4.1"] },
    { "id": 5, "tasks": ["4.2", "4.3", "4.6"] },
    { "id": 6, "tasks": ["4.4", "4.5", "5.1"] },
    { "id": 7, "tasks": ["5.2", "5.3", "6.1"] },
    { "id": 8, "tasks": ["5.4", "5.5", "6.2", "6.3"] },
    { "id": 9, "tasks": ["5.6", "6.4"] },
    { "id": 10, "tasks": ["5.7", "5.8", "6.5", "6.6"] },
    { "id": 11, "tasks": ["6.7", "7.1"] },
    { "id": 12, "tasks": ["6.8", "7.2", "7.3", "7.4", "7.5", "8.1"] },
    { "id": 13, "tasks": ["8.2", "8.3"] },
    { "id": 14, "tasks": ["8.4", "8.5", "8.6"] },
    { "id": 15, "tasks": ["8.7", "8.8", "8.9", "9.1"] },
    { "id": 16, "tasks": ["8.10", "9.2", "9.3"] },
    { "id": 17, "tasks": ["9.4", "9.5"] },
    { "id": 18, "tasks": ["9.6", "9.7", "10.1"] },
    { "id": 19, "tasks": ["9.8", "10.2", "10.3"] },
    { "id": 20, "tasks": ["10.4", "10.5", "10.6", "10.7"] },
    { "id": 21, "tasks": ["10.8", "11.1"] },
    { "id": 22, "tasks": ["11.2", "11.3", "11.4"] },
    { "id": 23, "tasks": ["11.5", "12.1", "12.2"] },
    { "id": 24, "tasks": ["12.3", "12.4", "12.5", "12.6"] },
    { "id": 25, "tasks": ["12.7", "13.1", "13.2", "13.3"] },
    { "id": 26, "tasks": ["13.4", "13.5", "14.1"] },
    { "id": 27, "tasks": ["14.2", "14.3", "14.4"] },
    { "id": 28, "tasks": ["14.5", "15.1"] },
    { "id": 29, "tasks": ["15.2", "15.3"] },
    { "id": 30, "tasks": ["15.4", "15.5"] },
    { "id": 31, "tasks": ["15.6", "16.1", "17.1"] },
    { "id": 32, "tasks": ["16.2", "16.3", "16.4", "17.2", "17.5"] },
    { "id": 33, "tasks": ["16.5", "16.6", "16.7", "17.3", "17.4"] },
    { "id": 34, "tasks": ["16.8", "17.6"] }
  ]
}
```
