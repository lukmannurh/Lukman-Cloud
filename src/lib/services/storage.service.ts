/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AetherVault — Serverless Cryptographic storage Service
 * Path: src/lib/services/storage.service.ts
 *
 * Rewritten to bypass local passphrases. It derives a stable master key
 * seamlessly using the static VITE_APP_TOTP_SECRET. This allows the VFS
 * system to encrypt and decrypt registry metadata without prompting the user.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { EncryptedData, EncryptedCredentialRecord } from '../../types';

const DB_NAME = 'aethervault_secure_vault';
const DB_VERSION = 1;
const STORE_CREDS = 'encrypted_credentials';

let masterCryptoKey: CryptoKey | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_CREDS)) {
        db.createObjectStore(STORE_CREDS, { keyPath: 'credentialKey' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

/**
 * Derives a consistent AES-256-GCM key from the environment secret seamlessly.
 */
async function getMasterKey(): Promise<CryptoKey> {
  if (masterCryptoKey) return masterCryptoKey;

  const secret = import.meta.env.VITE_APP_TOTP_SECRET || 'aethervault_fallback_secret_777';
  const encoder = new TextEncoder();
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const salt = encoder.encode('aethervault_static_registry_salt_v3');
  
  masterCryptoKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100_000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  return masterCryptoKey;
}

// ── Deprecated local locks (Stubbed for API compatibility) ───────────────────
export async function isVaultInitialized(): Promise<boolean> { return true; }
export async function initializeVault(_password: string): Promise<void> { /* no-op */ }
export async function unlockVault(_password: string): Promise<boolean> { return true; }
export function lockVault(): void { /* no-op */ }

// ── Encryption Core ────────────────────────────────────────────────────────
export async function encryptData(plaintext: Uint8Array, keyOverride?: CryptoKey): Promise<EncryptedData> {
  const key = keyOverride || await getMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  return {
    iv,
    ciphertext: new Uint8Array(ciphertextBuffer),
  };
}

export async function decryptData(encrypted: EncryptedData, keyOverride?: CryptoKey): Promise<Uint8Array> {
  const key = keyOverride || await getMasterKey();
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: encrypted.iv },
    key,
    encrypted.ciphertext
  );
  return new Uint8Array(plaintextBuffer);
}

// ── Storage API ────────────────────────────────────────────────────────────
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
  await new Promise<void>((resolve, reject) => {
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

  try {
    const encrypted: EncryptedData = {
      iv: new Uint8Array(record.iv),
      ciphertext: new Uint8Array(record.ciphertext),
    };
    const decrypted = await decryptData(encrypted);
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.warn(`[storage] Failed to decrypt credential "${key}":`, error);
    return null;
  }
}
