/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Lukman Cloud — Cryptographic storage (Milestone 1.3)
 *
 * Implements PBKDF2 key derivation and AES-256-GCM encryption using
 * native SubtleCrypto. Manages the IndexedDB `aethervault_secure_vault`
 * ensuring raw ArrayBuffer storage for salts and ciphertexts.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  EncryptedData,
  SecurityParamsRecord,
  EncryptedCredentialRecord,
} from '../types';

// ── Constants & Configuration ──────────────────────────────────────────────

const DB_NAME = 'aethervault_secure_vault';
const DB_VERSION = 1;

const STORE_PARAMS = 'security_params';
const STORE_CREDS = 'encrypted_credentials';

const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 32;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// ── Module-Scoped State (NEVER EXPOSED) ───────────────────────────────────

let masterCryptoKey: CryptoKey | null = null;
let idleTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

// ── IndexedDB Helpers ──────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PARAMS)) {
        db.createObjectStore(STORE_PARAMS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CREDS)) {
        db.createObjectStore(STORE_CREDS, { keyPath: 'credentialKey' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// ── Cryptographic Core ─────────────────────────────────────────────────────

/**
 * Derives an AES-256-GCM CryptoKey from a password and salt using PBKDF2.
 * Phase 0 SEC-01: extractable is STRICTLY false.
 */
async function deriveKey(password: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // MUST BE FALSE
    ['encrypt', 'decrypt']
  );
}

// ── Idle Timeout Management ────────────────────────────────────────────────

function resetIdleTimeout() {
  if (idleTimeoutHandle) {
    clearTimeout(idleTimeoutHandle);
  }
  if (masterCryptoKey) {
    idleTimeoutHandle = setTimeout(lockVault, IDLE_TIMEOUT_MS);
  }
}

/** Attach listeners to reset idle timeout on user interaction */
if (typeof window !== 'undefined') {
  const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
  events.forEach((event) =>
    window.addEventListener(event, resetIdleTimeout, { passive: true })
  );
}

// ── Public storage API ───────────────────────────────────────────────────────

/**
 * Checks if the storage is already initialized (salt exists).
 */
export async function isVaultInitialized(): Promise<boolean> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PARAMS, 'readonly');
    const store = tx.objectStore(STORE_PARAMS);
    const req = store.get('master_salt');
    req.onsuccess = () => resolve(!!req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Initializes the storage with a new master password. Generates and stores the salt.
 */
export async function initializeVault(password: string): Promise<void> {
  const initialized = await isVaultInitialized();
  if (initialized) {
    throw new Error('storage is already initialized.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  
  const record: SecurityParamsRecord = {
    id: 'master_salt',
    salt: salt.buffer,
    createdAt: new Date().toISOString(),
  };

  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_PARAMS, 'readwrite');
    const store = tx.objectStore(STORE_PARAMS);
    const req = store.add(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // Automatically unlock after init
  masterCryptoKey = await deriveKey(password, salt.buffer);
  resetIdleTimeout();
}

/**
 * Unlocks the storage using the master password.
 */
export async function unlockVault(password: string): Promise<boolean> {
  const db = await getDB();
  const saltRecord = await new Promise<SecurityParamsRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_PARAMS, 'readonly');
    const store = tx.objectStore(STORE_PARAMS);
    const req = store.get('master_salt');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (!saltRecord) {
    throw new Error('storage is not initialized.');
  }

  try {
    masterCryptoKey = await deriveKey(password, saltRecord.salt);
    resetIdleTimeout();
    return true;
  } catch (error) {
    console.error('Failed to derive key or unlock:', error);
    return false;
  }
}

/**
 * Locks the storage by immediately zeroing out the key reference.
 */
export function lockVault(): void {
  masterCryptoKey = null;
  if (idleTimeoutHandle) {
    clearTimeout(idleTimeoutHandle);
    idleTimeoutHandle = null;
  }
  console.log('[storage] storage locked.');
}

/**
 * Encrypts data using AES-256-GCM and the derived master key.
 */
export async function encryptData(plaintext: Uint8Array): Promise<EncryptedData> {
  if (!masterCryptoKey) {
    throw new Error('storage is locked. Cannot encrypt data.');
  }

  resetIdleTimeout();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    masterCryptoKey,
    plaintext
  );

  return {
    iv,
    ciphertext: new Uint8Array(ciphertextBuffer),
  };
}

/**
 * Decrypts data using AES-256-GCM and the derived master key.
 */
export async function decryptData(encrypted: EncryptedData): Promise<Uint8Array> {
  if (!masterCryptoKey) {
    throw new Error('storage is locked. Cannot decrypt data.');
  }

  resetIdleTimeout();
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: encrypted.iv },
    masterCryptoKey,
    encrypted.ciphertext
  );

  return new Uint8Array(plaintextBuffer);
}

// ── Credential Storage API ─────────────────────────────────────────────────

export async function storeCredential(key: EncryptedCredentialRecord['credentialKey'], data: string): Promise<void> {
  const enc = new TextEncoder();
  const encrypted = await encryptData(enc.encode(data));

  const record: EncryptedCredentialRecord = {
    credentialKey: key,
    iv: encrypted.iv.buffer,
    ciphertext: encrypted.ciphertext.buffer,
    encryptedAt: new Date().toISOString(),
  };

  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CREDS, 'readwrite');
    const store = tx.objectStore(STORE_CREDS);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function retrieveCredential(key: EncryptedCredentialRecord['credentialKey']): Promise<string | null> {
  const db = await getDB();
  const record = await new Promise<EncryptedCredentialRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_CREDS, 'readonly');
    const store = tx.objectStore(STORE_CREDS);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (!record) return null;

  const decrypted = await decryptData({
    iv: new Uint8Array(record.iv),
    ciphertext: new Uint8Array(record.ciphertext),
  });

  const dec = new TextDecoder();
  return dec.decode(decrypted);
}
