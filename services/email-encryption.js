// email-encryption.js - AES-256-GCM Encryption/Decryption for Email Credentials
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const AUTH_TAG_LENGTH = 16;
const IV_LENGTH = 16;

/**
 * Generate a random encryption key (32 bytes for AES-256)
 * Output format: base64-encoded hex string for easy env variable storage
 */
function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Encrypt a sensitive string using AES-256-GCM
 * @param {string} plaintext - Data to encrypt
 * @param {string} encryptionKey - 32-byte hex-encoded key (from env)
 * @returns {string} - Base64-encoded: base64(iv || authTag || ciphertext)
 * @throws {Error} if encryption fails
 */
function encrypt(plaintext, encryptionKey) {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Plaintext must be a non-empty string');
  }
  if (!encryptionKey || typeof encryptionKey !== 'string') {
    throw new Error('Encryption key required (from process.env.ENCRYPTION_KEY)');
  }

  try {
    // Convert hex key to buffer
    const key = Buffer.from(encryptionKey, 'hex');
    if (key.length !== 32) {
      throw new Error(`Encryption key must be 32 bytes (got ${key.length})`);
    }

    // Generate random IV for this encryption
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt
    let ciphertext = cipher.update(plaintext, 'utf8', 'binary');
    ciphertext += cipher.final('binary');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Combine: iv || authTag || ciphertext
    const combined = Buffer.concat([
      iv,
      authTag,
      Buffer.from(ciphertext, 'binary')
    ]);

    // Return as base64 for easy storage
    return combined.toString('base64');
  } catch (err) {
    throw new Error(`Encryption failed: ${err.message}`);
  }
}

/**
 * Decrypt an encrypted string
 * @param {string} encrypted - Base64-encoded: base64(iv || authTag || ciphertext)
 * @param {string} encryptionKey - 32-byte hex-encoded key (from env)
 * @returns {string} - Decrypted plaintext
 * @throws {Error} if decryption fails or tag verification fails
 */
function decrypt(encrypted, encryptionKey) {
  if (!encrypted || typeof encrypted !== 'string') {
    throw new Error('Encrypted data required');
  }
  if (!encryptionKey || typeof encryptionKey !== 'string') {
    throw new Error('Encryption key required (from process.env.ENCRYPTION_KEY)');
  }

  try {
    // Convert hex key to buffer
    const key = Buffer.from(encryptionKey, 'hex');
    if (key.length !== 32) {
      throw new Error(`Encryption key must be 32 bytes (got ${key.length})`);
    }

    // Decode base64
    const combined = Buffer.from(encrypted, 'base64');

    // Extract parts
    const iv = combined.slice(0, IV_LENGTH);
    const authTag = combined.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH + AUTH_TAG_LENGTH);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    // Set auth tag for verification
    decipher.setAuthTag(authTag);

    // Decrypt
    let plaintext = decipher.update(ciphertext, 'binary', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  } catch (err) {
    throw new Error(`Decryption failed: ${err.message}`);
  }
}

/**
 * Encrypt an object (password field)
 * Typically used for: { password: "secret" }
 */
function encryptObject(obj, encryptionKey, passwordField = 'password') {
  if (!obj || typeof obj !== 'object') return obj;

  const copy = { ...obj };
  if (copy[passwordField]) {
    copy[`${passwordField}_encrypted`] = encrypt(copy[passwordField], encryptionKey);
    delete copy[passwordField];
  }
  return copy;
}

/**
 * Decrypt an object
 * Typically used for: { password_encrypted: "..." } → { password: "secret" }
 */
function decryptObject(obj, encryptionKey, passwordField = 'password') {
  if (!obj || typeof obj !== 'object') return obj;

  const copy = { ...obj };
  const encryptedField = `${passwordField}_encrypted`;
  if (copy[encryptedField]) {
    copy[passwordField] = decrypt(copy[encryptedField], encryptionKey);
    delete copy[encryptedField];
  }
  return copy;
}

/**
 * Mask a sensitive value for display (e.g., in logs or frontend)
 * Example: "mypassword123" → "••••••••123" (shows last 3 chars)
 */
function maskSecret(secret, showChars = 3) {
  if (!secret || typeof secret !== 'string') return '••••••••';
  if (secret.length <= showChars) return '•'.repeat(Math.max(8, secret.length));
  return '•'.repeat(Math.max(8, secret.length - showChars)) + secret.slice(-showChars);
}

module.exports = {
  generateEncryptionKey,
  encrypt,
  decrypt,
  encryptObject,
  decryptObject,
  maskSecret
};