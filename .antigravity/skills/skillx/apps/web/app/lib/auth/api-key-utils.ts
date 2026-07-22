/**
 * Generate a new API key with prefix, plaintext, and hash
 * Format: sx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (35 chars total)
 */
export async function generateApiKey(): Promise<{
  plaintext: string;
  hash: string;
  prefix: string;
}> {
  // Generate 32 random bytes
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);

  // Convert to hex string
  const keyPart = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Create full key with prefix
  const plaintext = `sx_${keyPart}`;
  const prefix = plaintext.substring(0, 8); // "sx_xxxxx"

  // Hash the key for storage using SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return { plaintext, hash, prefix };
}

/**
 * Verify an API key against a stored hash
 */
export async function verifyApiKey(plaintext: string, storedHash: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return hash === storedHash;
}
