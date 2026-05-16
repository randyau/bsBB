/**
 * Encryption helpers for sensitive data at rest (e.g., ATproto chat tokens).
 *
 * Uses AES-256-GCM via Node.js crypto module.
 * Key must be 32 bytes (256 bits), stored in ENCRYPTION_KEY env var.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const AUTH_TAG_LENGTH = 16; // bytes
const IV_LENGTH = 16; // bytes

function getKey(): Buffer {
	const key = process.env.ENCRYPTION_KEY;
	if (!key) {
		throw new Error('ENCRYPTION_KEY environment variable not set');
	}

	// If key is hex string, convert it; otherwise treat as raw bytes
	if (/^[0-9a-f]{64}$/i.test(key)) {
		return Buffer.from(key, 'hex');
	}

	// Ensure it's 32 bytes
	const buf = Buffer.from(key);
	if (buf.length !== 32) {
		throw new Error(`ENCRYPTION_KEY must be 32 bytes (${buf.length} provided)`);
	}
	return buf;
}

/**
 * Encrypt data using AES-256-GCM.
 * Returns a base64-encoded string suitable for storage in a TEXT/VARCHAR column.
 *
 * Format: base64(iv + authTag + ciphertext)
 */
export function encrypt(plaintext: string): string {
	const key = getKey();
	const iv = crypto.randomBytes(IV_LENGTH);
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

	let encrypted = cipher.update(plaintext, 'utf8', 'hex');
	encrypted += cipher.final('hex');

	const authTag = cipher.getAuthTag();

	// Combine: IV + authTag + ciphertext
	const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]);
	return combined.toString('base64');
}

/**
 * Decrypt data encrypted with encrypt().
 * Input is base64-encoded ciphertext from encrypt().
 */
export function decrypt(encrypted: string): string {
	const key = getKey();
	const combined = Buffer.from(encrypted, 'base64');

	// Extract: IV + authTag + ciphertext
	const iv = combined.slice(0, IV_LENGTH);
	const authTag = combined.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
	const ciphertext = combined.slice(IV_LENGTH + AUTH_TAG_LENGTH);

	const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);

	let decrypted = decipher.update(ciphertext.toString('hex'), 'hex', 'utf8');
	decrypted += decipher.final('utf8');

	return decrypted;
}

/**
 * Generate a random 32-byte encryption key (hex-encoded).
 * Use this during setup to generate ENCRYPTION_KEY env var.
 */
export function generateKey(): string {
	return crypto.randomBytes(32).toString('hex');
}
