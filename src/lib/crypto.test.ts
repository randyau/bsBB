import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt, generateKey } from './crypto';

describe('crypto — AES-256-GCM encryption', () => {
	beforeAll(() => {
		// Set a valid 32-byte hex encryption key for tests
		process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
	});

	it('encrypt produces base64-encoded output', () => {
		const plaintext = 'secret message';
		const encrypted = encrypt(plaintext);
		expect(encrypted).toMatch(/^[A-Za-z0-9+/]+={0,2}$/); // Valid base64
	});

	it('decrypt reverses encrypt', () => {
		const plaintext = 'hello world';
		const encrypted = encrypt(plaintext);
		const decrypted = decrypt(encrypted);
		expect(decrypted).toBe(plaintext);
	});

	it('encrypt produces different output each call (random IV)', () => {
		const plaintext = 'same message';
		const enc1 = encrypt(plaintext);
		const enc2 = encrypt(plaintext);
		expect(enc1).not.toBe(enc2); // Different due to random IV
		expect(decrypt(enc1)).toBe(plaintext);
		expect(decrypt(enc2)).toBe(plaintext);
	});

	it('handles empty strings', () => {
		const plaintext = '';
		const encrypted = encrypt(plaintext);
		const decrypted = decrypt(encrypted);
		expect(decrypted).toBe(plaintext);
	});

	it('handles unicode and special characters', () => {
		const plaintext = '🔒 Secure: café, naïve, 你好';
		const encrypted = encrypt(plaintext);
		const decrypted = decrypt(encrypted);
		expect(decrypted).toBe(plaintext);
	});

	it('handles large payloads', () => {
		const plaintext = 'x'.repeat(10000);
		const encrypted = encrypt(plaintext);
		const decrypted = decrypt(encrypted);
		expect(decrypted).toBe(plaintext);
	});

	it('decrypt with tampered ciphertext throws auth tag error', () => {
		const plaintext = 'message';
		const encrypted = encrypt(plaintext);
		const buffer = Buffer.from(encrypted, 'base64');

		// Tamper with the last byte
		buffer[buffer.length - 1] ^= 0xff;
		const tamperedEncrypted = buffer.toString('base64');

		expect(() => decrypt(tamperedEncrypted)).toThrow();
	});

	it('generateKey produces 64-char hex string (32 bytes)', () => {
		const key = generateKey();
		expect(key).toMatch(/^[0-9a-f]{64}$/);
		expect(key.length).toBe(64);
	});

	it('generateKey produces different keys', () => {
		const key1 = generateKey();
		const key2 = generateKey();
		expect(key1).not.toBe(key2);
	});

	it('throws error when ENCRYPTION_KEY not set', () => {
		const original = process.env.ENCRYPTION_KEY;
		delete process.env.ENCRYPTION_KEY;

		expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable not set');

		process.env.ENCRYPTION_KEY = original;
	});

	it('accepts hex-encoded key in ENCRYPTION_KEY', () => {
		const hexKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
		process.env.ENCRYPTION_KEY = hexKey;

		const plaintext = 'test';
		const encrypted = encrypt(plaintext);
		const decrypted = decrypt(encrypted);
		expect(decrypted).toBe(plaintext);
	});

	it('rejects key that is not 32 bytes', () => {
		process.env.ENCRYPTION_KEY = 'tooshort'; // 8 bytes

		expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be 32 bytes');

		// Restore valid key
		process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
	});
});
