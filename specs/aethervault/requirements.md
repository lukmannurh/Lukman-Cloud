# Requirements Document — Lukman Cloud

## Introduction

Lukman Cloud is a client-side multi-cloud storage aggregator that unifies Google Drive (15GB) and Telegram Channel Storage (unlimited) under a single encrypted Virtual File System. The application runs entirely in the browser as a static site on Vercel Free Tier, with all cryptographic operations, file chunking, and cloud provider communication happening directly on the client. No server-side file proxying occurs, eliminating Vercel's timeout and payload constraints. Metadata is stored as directory-specific JSON files in Google Drive's hidden appDataFolder, and all data is encrypted using AES-256-GCM with master password protection. The app employs a Bring-Your-Own-Storage (BYOS) multi-user model — each trusted user brings their own Google Drive and Telegram accounts, with zero shared backend. Access is gated by a client-side Access Code and a server-side Google OAuth Testing Mode whitelist.

## Glossary

- **AetherVault**: The client-side multi-cloud storage aggregator system
- **VFS**: Virtual File System that presents a unified view of files across multiple storage providers
- **Master_Password**: User-provided secret used to derive encryption keys via PBKDF2
- **Encryption_Engine**: Component responsible for AES-256-GCM encryption/decryption using Web Crypto API
- **Metadata_Manager**: Component that handles directory-based JSON metadata files
- **Storage_Router**: Component that decides whether files go to Google Drive or Telegram based on size and quota
- **Telegram_Client**: Component that manages Telegram MTProto WebSocket connections via GramJS
- **Drive_Client**: Component that manages Google Drive API interactions with PKCE OAuth
- **Session_Manager**: Component that handles vault lock/unlock state and session timeout
- **FolderDocument**: JSON metadata structure containing file entries and cloud storage references
- **GoogleDriveRef**: Metadata reference with discriminant `provider: 'google_drive'`, containing Google Drive file ID and MD5 checksum
- **TelegramRef**: Metadata reference with discriminant `provider: 'telegram'`, containing Telegram channel ID, originalFilename, whole-file SHA-256 hash, and ordered TelegramChunk array (partIndex, messageId, chunkSize)
- **TelegramChunk**: A single chunk entry in TelegramRef.chunks: `{ partIndex: number, messageId: number, chunkSize: number }`. Invariant: chunks[i].partIndex === i for all i.
- **AppDataFolder**: Hidden Google Drive folder for storing application metadata
- **Chunk**: 2GB segment of a file split for Telegram storage
- **ETag**: Entity tag used for optimistic locking on Google Drive metadata updates
- **BroadcastChannel_Leader**: Single tab elected to serialize metadata writes across multiple browser tabs
- **IndexedDB_Store**: Browser storage containing encrypted credentials and security parameters
- **PKCE**: Proof Key for Code Exchange - OAuth flow for public clients
- **Security_Params**: Salt and PBKDF2 iteration count stored in IndexedDB
- **Encrypted_Credentials**: Encrypted OAuth tokens and Telegram session data stored in IndexedDB
- **Idle_Timeout**: 30-minute period of inactivity after which vault auto-locks
- **Safety_Buffer**: 500MB reserved space threshold on Google Drive before overflow to Telegram
- **Web_Worker**: Separate thread for handling Telegram chunking operations
- **SubtleCrypto**: Web Crypto API interface for cryptographic operations

## Requirements

### Requirement 1: Master Password Vault Security

**User Story:** As a user, I want my files protected by a master password with strong encryption, so that my data remains secure even if cloud storage is compromised.

#### Acceptance Criteria

1. WHEN a user creates a vault for the first time, THE Encryption_Engine SHALL generate a cryptographic salt and derive an AES-256-GCM key using PBKDF2 with 600,000 iterations
2. THE Encryption_Engine SHALL encrypt all OAuth tokens and Telegram session data using AES-256-GCM before storing in IndexedDB_Store
3. WHEN a user enters the Master_Password, THE Encryption_Engine SHALL derive the encryption key and decrypt the Encrypted_Credentials
4. THE Session_Manager SHALL store the derived encryption key only in volatile memory using closure isolation
5. IF the Master_Password is incorrect, THEN THE Encryption_Engine SHALL return an authentication error without revealing whether credentials exist
6. THE Encryption_Engine SHALL use Web Crypto API SubtleCrypto for all cryptographic operations
7. THE Security_Params SHALL be stored unencrypted in IndexedDB_Store (salt and iteration count are not secret)
8. FOR ALL encryption operations, THE Encryption_Engine SHALL generate a unique initialization vector (IV) and store it with the ciphertext

### Requirement 2: Vault Locking and Session Management

**User Story:** As a user, I want my vault to automatically lock after inactivity, so that my data is protected if I leave my device unattended.

#### Acceptance Criteria

1. WHEN the vault is unlocked, THE Session_Manager SHALL start an Idle_Timeout timer set to 30 minutes
2. WHEN user interaction occurs, THE Session_Manager SHALL reset the Idle_Timeout timer to 30 minutes
3. WHEN the Idle_Timeout expires, THE Session_Manager SHALL clear the encryption key from memory and transition vault to locked state
4. WHEN the vault locks, THE Session_Manager SHALL clear all decrypted credentials from memory
5. WHEN a user manually locks the vault, THE Session_Manager SHALL immediately clear the encryption key and transition to locked state
6. WHILE the vault is locked, THE AetherVault SHALL require Master_Password re-entry before allowing any file operations

### Requirement 3: Directory-Based Metadata Storage

**User Story:** As a user, I want my file metadata stored efficiently in the cloud, so that the application remains fast and avoids external database dependencies.

#### Acceptance Criteria

1. THE Metadata_Manager SHALL store each directory's metadata in a separate JSON file named `folder_<uuid>.json` in Google Drive's AppDataFolder
2. THE FolderDocument SHALL contain folder name, parent folder reference, list of child files, and list of child folders
3. WHEN a file is added to a folder, THE Metadata_Manager SHALL update only that folder's FolderDocument
4. THE Metadata_Manager SHALL use ETag-based optimistic locking when updating FolderDocument files on Google Drive
5. IF an ETag mismatch occurs during update, THEN THE Metadata_Manager SHALL fetch the latest version, merge changes, and retry the update
6. THE Metadata_Manager SHALL store GoogleDriveRef containing Drive file ID and MD5 checksum for files stored in Google Drive
7. THE Metadata_Manager SHALL store TelegramRef containing channel ID and array of message IDs for files stored in Telegram
8. WHEN metadata operations occur across multiple browser tabs, THE Metadata_Manager SHALL use BroadcastChannel_Leader election to serialize writes

### Requirement 4: Multi-Tab Coordination

**User Story:** As a user, I want to use AetherVault in multiple browser tabs simultaneously, so that I can manage files flexibly without conflicts.

#### Acceptance Criteria

1. WHEN multiple tabs have AetherVault open, THE Metadata_Manager SHALL elect one tab as BroadcastChannel_Leader
2. THE BroadcastChannel_Leader SHALL serialize all metadata write operations to prevent conflicts
3. WHEN the BroadcastChannel_Leader tab closes, THE Metadata_Manager SHALL elect a new leader from remaining tabs
4. WHEN a non-leader tab requests a metadata write, THE Metadata_Manager SHALL forward the request to the BroadcastChannel_Leader
5. THE Metadata_Manager SHALL broadcast metadata change notifications to all tabs via BroadcastChannel
6. WHEN a tab receives a metadata change notification, THE Metadata_Manager SHALL refresh its local view

### Requirement 5: Smart Storage Allocation

**User Story:** As a user, I want files automatically distributed between Google Drive and Telegram based on size and quota, so that I maximize storage efficiency.

#### Acceptance Criteria

1. WHEN a file smaller than 20MB is uploaded, THE Storage_Router SHALL default to storing the file in Google Drive
2. WHEN Google Drive available quota is less than file size plus Safety_Buffer (500MB), THE Storage_Router SHALL store the file in Telegram
3. WHEN a file larger than or equal to 20MB is uploaded, THE Storage_Router SHALL store the file in Telegram
4. THE Storage_Router SHALL query Google Drive quota before each upload decision
5. WHEN Google Drive quota is depleted below Safety_Buffer, THE Storage_Router SHALL route all subsequent files to Telegram regardless of size
6. THE Storage_Router SHALL allow manual override to force specific storage backend selection

### Requirement 6: Google Drive Integration

**User Story:** As a user, I want secure access to Google Drive without server-side secrets, so that the application remains fully client-side.

#### Acceptance Criteria

1. THE Drive_Client SHALL use OAuth 2.0 PKCE authorization code flow for authentication
2. THE Drive_Client SHALL generate a cryptographic code verifier and code challenge for each PKCE flow
3. WHEN requesting OAuth authorization, THE Drive_Client SHALL request offline access scope for refresh tokens
4. THE Drive_Client SHALL encrypt OAuth access tokens and refresh tokens before storing in IndexedDB_Store
5. WHEN an access token expires, THE Drive_Client SHALL use the refresh token to obtain a new access token
6. THE Drive_Client SHALL store all FolderDocument files in Google Drive's AppDataFolder
7. THE Drive_Client SHALL use streaming APIs for file uploads to handle files larger than available RAM
8. WHEN uploading files to Google Drive, THE Drive_Client SHALL compute and store MD5 checksums in GoogleDriveRef
9. WHEN downloading files from Google Drive, THE Drive_Client SHALL verify MD5 checksum matches the stored value

### Requirement 7: Telegram Multi-Chunking Engine

**User Story:** As a user, I want to store large files in Telegram without size limitations, so that I can leverage unlimited cloud storage.

#### Acceptance Criteria

1. THE Telegram_Client SHALL use GramJS library for MTProto WebSocket communication
2. THE Telegram_Client SHALL execute all Telegram operations in a Web_Worker to avoid blocking the UI thread
3. WHEN a file larger than 2GB is uploaded to Telegram, THE Telegram_Client SHALL split the file into sequential 2GB Chunks
4. THE Telegram_Client SHALL upload each Chunk as a separate message to the configured Telegram channel
5. THE Telegram_Client SHALL compute a SHA-256 hash of the COMPLETE original file BEFORE chunking begins, and store it in TelegramRef.sha256Hash. This whole-file hash is verified AFTER full reassembly on download.
6. THE Telegram_Client SHALL store the array of TelegramChunk entries (partIndex, messageId, chunkSize) in TelegramRef.chunks, maintaining sequential order. INVARIANT: chunks[i].partIndex === i for all i.
7. WHEN downloading a multi-chunk file from Telegram, THE Telegram_Client SHALL retrieve chunks in sequential partIndex order
8. WHEN all chunks are downloaded and reassembled, THE Telegram_Client SHALL verify the SHA-256 hash of the complete reassembled file matches TelegramRef.sha256Hash
9. IF the whole-file hash mismatch occurs, THEN THE Telegram_Client SHALL surface a file integrity error to the user
10. THE Telegram_Client SHALL reassemble chunks into the complete file after all chunks are downloaded and verified

### Requirement 8: Telegram Authentication and Session Management

**User Story:** As a user, I want to authenticate with Telegram securely, so that I can use Telegram storage without compromising my account.

#### Acceptance Criteria

1. THE Telegram_Client SHALL support phone number and bot token authentication methods
2. WHEN authenticating with phone number, THE Telegram_Client SHALL handle two-factor authentication if enabled
3. THE Telegram_Client SHALL encrypt Telegram session data using the Master_Password-derived key before storing in IndexedDB_Store
4. THE Telegram_Client SHALL persist session data to avoid re-authentication on subsequent vault unlocks
5. WHEN the vault is locked, THE Telegram_Client SHALL clear all decrypted Telegram session data from memory

### Requirement 9: Client-Side File Encryption

**User Story:** As a user, I want all files encrypted before upload, so that cloud providers cannot access my file contents.

#### Acceptance Criteria

1. WHEN a file is uploaded, THE Encryption_Engine SHALL encrypt the file using AES-256-GCM with the Master_Password-derived key
2. THE Encryption_Engine SHALL generate a unique IV for each file encryption operation
3. THE Encryption_Engine SHALL prepend the IV to the encrypted file data before upload
4. WHEN a file is downloaded, THE Encryption_Engine SHALL extract the IV from the beginning of the encrypted data
5. THE Encryption_Engine SHALL decrypt the file using AES-256-GCM with the Master_Password-derived key and extracted IV
6. THE Encryption_Engine SHALL verify the authentication tag during decryption
7. IF authentication tag verification fails, THEN THE Encryption_Engine SHALL return a tampering error and refuse to decrypt

### Requirement 10: Virtual File System Interface

**User Story:** As a user, I want to navigate folders and files in a familiar hierarchy, so that I can organize my cloud storage intuitively.

#### Acceptance Criteria

1. THE VFS SHALL present a hierarchical folder structure with root, subfolders, and files
2. THE VFS SHALL support creating new folders at any level of the hierarchy
3. THE VFS SHALL support renaming folders and files
4. THE VFS SHALL support moving files and folders between directories
5. THE VFS SHALL support deleting files and folders
6. WHEN a folder is deleted, THE VFS SHALL recursively delete all child folders and files
7. THE VFS SHALL update affected FolderDocument files when folder operations occur
8. THE VFS SHALL maintain referential integrity between parent and child folder references

### Requirement 11: File Upload Pipeline

**User Story:** As a user, I want to upload files with progress feedback, so that I can monitor long-running uploads.

#### Acceptance Criteria

1. WHEN a user selects files for upload, THE AetherVault SHALL display an upload queue with progress indicators
2. THE AetherVault SHALL encrypt each file client-side before beginning upload
3. THE Storage_Router SHALL determine the target storage backend before starting upload
4. THE AetherVault SHALL upload files directly from browser to the target storage backend without server proxying
5. THE AetherVault SHALL report upload progress percentage based on bytes transferred
6. WHEN an upload completes successfully, THE Metadata_Manager SHALL update the parent FolderDocument with the new file entry
7. IF an upload fails, THEN THE AetherVault SHALL display an error message and allow retry
8. THE AetherVault SHALL support pausing and resuming uploads where the storage backend permits

### Requirement 12: File Download Pipeline

**User Story:** As a user, I want to download files with progress feedback, so that I can monitor long-running downloads.

#### Acceptance Criteria

1. WHEN a user requests file download, THE AetherVault SHALL retrieve the file directly from the storage backend to the browser
2. THE AetherVault SHALL report download progress percentage based on bytes transferred
3. WHEN download completes, THE Encryption_Engine SHALL decrypt the file client-side
4. WHEN decryption completes, THE AetherVault SHALL trigger browser download with the original filename
5. IF download fails, THEN THE AetherVault SHALL display an error message and allow retry
6. WHEN downloading multi-chunk Telegram files, THE AetherVault SHALL display aggregate progress across all chunks

### Requirement 13: Metadata Integrity Invariants

**User Story:** As a system, I want to maintain metadata consistency, so that the VFS remains reliable and corruption-free.

#### Acceptance Criteria

1. THE Metadata_Manager SHALL enforce INV-01: Every file entry SHALL have exactly one storage reference (GoogleDriveRef XOR TelegramRef)
2. THE Metadata_Manager SHALL enforce INV-02: Every non-root FolderDocument SHALL have a valid parent folder reference
3. THE Metadata_Manager SHALL enforce INV-03: Folder references SHALL form a directed acyclic graph with single root
4. THE Metadata_Manager SHALL enforce INV-04: Every GoogleDriveRef SHALL contain a non-empty file ID and MD5 checksum
5. THE Metadata_Manager SHALL enforce INV-05: Every TelegramRef SHALL contain a non-empty channel ID and non-empty chunks array
6. THE Metadata_Manager SHALL enforce INV-06: TelegramRef chunks array SHALL be ordered sequentially
7. THE Metadata_Manager SHALL enforce INV-07: Each chunk in TelegramRef SHALL contain message ID and SHA-256 hash
8. THE Metadata_Manager SHALL enforce INV-08: FolderDocument UUID SHALL be unique across all metadata files

### Requirement 14: IndexedDB Security Topology

**User Story:** As a system, I want to organize encrypted data in IndexedDB, so that credentials are protected at rest.

#### Acceptance Criteria

1. THE AetherVault SHALL create an IndexedDB database named `aethervault_secure_vault` with two primary object stores: `security_params` and `encrypted_credentials`
2. THE `security_params` object store SHALL contain the PBKDF2 salt as a raw **ArrayBuffer** (32 bytes / 256-bit, NOT base64-encoded string) and vault schema version
3. THE `encrypted_credentials` object store SHALL contain encrypted OAuth tokens and Telegram session data, with `iv` and `ciphertext` stored as **ArrayBuffer** values (NOT base64 strings)
4. THE AetherVault SHALL store the encryption IV as an **ArrayBuffer** alongside each encrypted credential entry
5. THE AetherVault SHALL NOT store the Master_Password or derived encryption key in IndexedDB
6. ALL CryptoKey objects derived from the Master_Password SHALL be created with `extractable: false` so key material can never be exported from the SubtleCrypto boundary (Phase 0 SEC-01)
7. WHEN the browser clears site data, THE AetherVault SHALL lose access to credentials and require re-authentication with cloud providers

### Requirement 15: Neobrutalism User Interface

**User Story:** As a user, I want a visually distinctive and high-contrast interface, so that the application is easy to use and aesthetically appealing.

#### Acceptance Criteria

1. THE AetherVault SHALL use 3px solid borders on all interactive elements
2. THE AetherVault SHALL use hard drop shadows (no blur) on cards and containers
3. THE AetherVault SHALL use high-contrast color combinations for text and backgrounds
4. THE AetherVault SHALL be fully responsive and optimized for mobile devices
5. THE AetherVault SHALL display folder hierarchy as a navigable tree or breadcrumb interface
6. THE AetherVault SHALL indicate vault lock status prominently in the UI
7. THE AetherVault SHALL display remaining Google Drive quota and Telegram connection status

### Requirement 16: Application Bootstrap and Static Hosting

**User Story:** As a user, I want to access AetherVault through a URL without installation, so that I can use it from any device with a browser.

#### Acceptance Criteria

1. THE AetherVault SHALL be deployable as a static site on Vercel Free Tier
2. THE AetherVault SHALL be built using Vite, React 19, and TypeScript in strict mode
3. THE AetherVault SHALL use Tailwind CSS v4 with custom Neobrutalism design tokens
4. THE AetherVault SHALL include all dependencies in the client-side bundle
5. THE AetherVault SHALL NOT require server-side API routes or backend services
6. THE AetherVault SHALL load entirely in the browser and function offline after initial load

### Requirement 17: Error Handling and User Feedback

**User Story:** As a user, I want clear error messages when operations fail, so that I can understand and resolve issues.

#### Acceptance Criteria

1. WHEN a network error occurs, THE AetherVault SHALL display a user-friendly error message indicating connection failure
2. WHEN an authentication error occurs, THE AetherVault SHALL prompt the user to re-authenticate with the affected provider
3. WHEN a decryption error occurs, THE AetherVault SHALL display a message indicating possible file corruption or wrong password
4. WHEN quota limits are reached, THE AetherVault SHALL display remaining storage and suggest using the alternate provider
5. WHEN a file operation fails, THE AetherVault SHALL display the operation type, filename, and error reason
6. THE AetherVault SHALL log detailed error information to browser console for debugging purposes

### Requirement 18: Vault Initialization Flow

**User Story:** As a new user, I want to set up my vault with a master password and connect cloud providers, so that I can start using AetherVault.

#### Acceptance Criteria

1. WHEN a user visits AetherVault for the first time, THE AetherVault SHALL detect absence of Security_Params in IndexedDB
2. THE AetherVault SHALL prompt the user to create a Master_Password with minimum 12 characters
3. THE AetherVault SHALL display password strength indicator during Master_Password creation
4. WHEN Master_Password is set, THE Encryption_Engine SHALL generate Security_Params and store them in IndexedDB
5. THE AetherVault SHALL guide the user through Google Drive OAuth PKCE flow
6. THE AetherVault SHALL guide the user through Telegram authentication flow
7. THE AetherVault SHALL encrypt and store all credentials in IndexedDB before marking initialization complete
8. THE AetherVault SHALL create the root FolderDocument in Google Drive AppDataFolder after initialization

### Requirement 19: Configuration and Settings Management

**User Story:** As a user, I want to configure storage preferences and security settings, so that I can customize AetherVault to my needs.

#### Acceptance Criteria

1. THE AetherVault SHALL provide a settings interface for modifying the file size threshold (default 20MB) for storage routing
2. THE AetherVault SHALL allow users to configure the Safety_Buffer value (default 500MB)
3. THE AetherVault SHALL allow users to configure the Idle_Timeout duration (default 30 minutes)
4. THE AetherVault SHALL allow users to configure the target Telegram channel for file storage
5. THE AetherVault SHALL encrypt configuration settings with the Master_Password-derived key before storage
6. THE AetherVault SHALL allow users to re-authenticate with Google Drive or Telegram without resetting the vault

### Requirement 20: File Search and Filtering

**User Story:** As a user, I want to search for files by name, so that I can quickly locate files in my vault.

#### Acceptance Criteria

1. THE AetherVault SHALL provide a search input that filters visible files by name
2. THE AetherVault SHALL perform case-insensitive partial matching on file names
3. THE AetherVault SHALL display search results with the folder path for each matching file
4. THE AetherVault SHALL update search results in real-time as the user types
5. THE AetherVault SHALL allow clearing the search to return to normal folder view

### Requirement 21: Credential Revocation and Vault Reset

**User Story:** As a user, I want to revoke cloud provider access and reset my vault, so that I can start fresh or secure my account if compromised.

#### Acceptance Criteria

1. THE AetherVault SHALL provide a "Reset Vault" option in settings
2. WHEN vault reset is initiated, THE AetherVault SHALL prompt for Master_Password confirmation
3. WHEN vault reset is confirmed, THE AetherVault SHALL clear all IndexedDB data including Security_Params and Encrypted_Credentials
4. THE AetherVault SHALL instruct the user to manually revoke OAuth permissions in Google Account settings
5. THE AetherVault SHALL instruct the user to manually terminate Telegram sessions if desired
6. THE AetherVault SHALL NOT delete user files from Google Drive or Telegram during vault reset
7. WHEN vault reset completes, THE AetherVault SHALL return to the initialization flow

### Requirement 22: File Metadata Display

**User Story:** As a user, I want to see file details like size, upload date, and storage location, so that I can manage my files effectively.

#### Acceptance Criteria

1. THE VFS SHALL display file size in human-readable format (KB, MB, GB)
2. THE VFS SHALL display file upload timestamp
3. THE VFS SHALL indicate whether each file is stored in Google Drive or Telegram
4. THE VFS SHALL display file type icon based on file extension
5. WHEN a file is selected, THE VFS SHALL display additional metadata including encryption status and chunk count for Telegram files

### Requirement 23: Browser Compatibility and Web Standards

**User Story:** As a user, I want AetherVault to work in modern browsers, so that I can access it from different devices.

#### Acceptance Criteria

1. THE AetherVault SHALL function correctly in Chromium-based browsers (Chrome, Edge, Brave) version 90 or later
2. THE AetherVault SHALL function correctly in Firefox version 88 or later
3. THE AetherVault SHALL function correctly in Safari version 14 or later
4. THE AetherVault SHALL verify SubtleCrypto API availability before attempting cryptographic operations
5. THE AetherVault SHALL verify IndexedDB availability before attempting storage operations
6. THE AetherVault SHALL verify BroadcastChannel API availability before attempting multi-tab coordination
7. IF required APIs are unavailable, THEN THE AetherVault SHALL display a compatibility error message

### Requirement 24: Performance and Resource Management

**User Story:** As a user, I want AetherVault to handle large files efficiently, so that my browser remains responsive.

#### Acceptance Criteria

1. THE AetherVault SHALL process files in streams to avoid loading entire files into memory
2. THE Telegram_Client SHALL execute file chunking operations in a Web_Worker
3. THE Encryption_Engine SHALL perform encryption and decryption in chunks to avoid blocking the UI thread
4. THE AetherVault SHALL limit concurrent uploads to 3 files to prevent resource exhaustion
5. THE AetherVault SHALL limit concurrent downloads to 3 files to prevent resource exhaustion
6. THE AetherVault SHALL release memory references to large file buffers after operations complete

### Requirement 25: Data Validation and Sanitization

**User Story:** As a system, I want to validate all user inputs and data structures, so that the application remains stable and secure.

#### Acceptance Criteria

1. THE Lukman Cloud SHALL validate folder names to prevent path traversal characters (/, \, ..)
2. THE Lukman Cloud SHALL validate file names to prevent invalid filesystem characters
3. THE Lukman Cloud SHALL validate Master_Password meets minimum complexity requirements (12 characters, mixed case, numbers)
4. THE Metadata_Manager SHALL validate FolderDocument JSON schema before persisting to Google Drive
5. THE Metadata_Manager SHALL validate all UUIDs are properly formatted v4 UUIDs
6. THE Lukman Cloud SHALL sanitize all user-provided strings before rendering in the UI to prevent XSS attacks
7. THE Lukman Cloud SHALL validate file size does not exceed 2GB per chunk for Telegram uploads

### Requirement 26: TOTP Access Code Gate

**User Story:** As Lukman, I want to require a Time-Based One-Time Password (TOTP) before new vault initialization, so that I can share a temporary 6-digit code with trusted family members and it automatically expires, preventing any static code from being permanently leaked.

#### Acceptance Criteria

1. THE Lukman Cloud SHALL read the `VITE_APP_TOTP_SECRET` environment variable (a Base32-encoded HMAC seed) at build time via Vite's `import.meta.env` mechanism and embed it in the compiled JS bundle
2. WHEN the app detects an uninitialized vault state (no `security_params["master_salt"]` record in IndexedDB), THE Lukman Cloud SHALL display a TOTP prompt requesting a 6-digit code BEFORE any vault creation UI is shown
3. THE Access_Code_Gate SHALL validate the user-entered 6-digit code using the RFC 6238 TOTP algorithm with the following locked parameters:
   - **Algorithm:** HMAC-SHA-1 (as per RFC 6238 / RFC 4226 HOTP base)
   - **Digits:** 6
   - **Period:** 300 seconds (5-minute window) — uses `import.meta.env.VITE_APP_TOTP_PERIOD` if set, otherwise defaults to 300
   - **Implementation:** Zero-dependency, browser-native `SubtleCrypto` HMAC-SHA-1
   - **Secret encoding:** Standard Base32 (RFC 4648), decoded client-side
4. THE Access_Code_Gate SHALL accept the TOTP code for the **current** time window AND the **immediately preceding** time window (a ±1 window drift tolerance of ±300 seconds) to account for clock skew between Lukman's authenticator app and the user's device
5. IF the entered TOTP code does not match any valid window, THEN THE Lukman Cloud SHALL display an error message: "Invalid or expired code. Please ask Lukman for a fresh code." and HARD-BLOCK vault creation — no partial initialization is permitted
6. IF the TOTP code validates successfully, THEN THE Lukman Cloud SHALL transition to the Master Password creation screen
7. WHEN the app detects an existing initialized vault state (security_params present in IndexedDB), THE Lukman Cloud SHALL skip the TOTP Gate entirely and display the vault unlock screen directly
8. THE Lukman Cloud SHALL NOT rate-limit TOTP code attempts (brute-force defense is delegated to the Google OAuth Testing Mode layer)
9. THE TOTP Gate state SHALL be purely in-memory (never persisted to IndexedDB) — a valid TOTP code must be re-entered on each new device initialization
10. THE Lukman Cloud documentation SHALL specify that the `VITE_APP_TOTP_SECRET` must be configured in an authenticator app that supports **custom TOTP periods** (e.g., Aegis Authenticator, andOTP, 1Password, Bitwarden) — apps that only support 30-second periods (e.g., standard Google Authenticator) will NOT work with the 300-second period

### Requirement 27: Google OAuth Testing Mode Guard

**User Story:** As Lukman, I want only pre-approved Gmail addresses to be able to complete Google Drive OAuth authorization, so that strangers who bypass the client-side access gate are still blocked at Google's infrastructure level from connecting to any Google Drive storage.

#### Acceptance Criteria

1. THE Google Cloud Console project used by Lukman Cloud SHALL maintain its OAuth consent screen in "Testing" publishing status (NOT "In Production") to enforce email-level whitelisting at Google's server infrastructure
2. THE test user list in Google Cloud Console SHALL contain ONLY the Gmail addresses of family members and friends that Lukman has explicitly pre-approved
3. WHEN an unauthorized Gmail account attempts to complete the OAuth PKCE flow, Google SHALL return an "Access Blocked" error, and THE Lukman Cloud SHALL display a user-friendly message: "Your Google account is not authorized for this application. Please contact the administrator."
4. THE Lukman Cloud documentation SHALL include step-by-step instructions for adding and removing test users in Google Cloud Console, including how to revoke access for a previously authorized user
5. THE Lukman Cloud SHALL NOT implement any client-side email whitelist — all email-level access control is exclusively delegated to Google's OAuth infrastructure to prevent client-side bypass
