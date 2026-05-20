import { describe, it, expect } from 'vitest';
import {
	generateAssetSlug,
	resolveAssetReferences,
	canAccessAssets,
	getAssetUrl,
} from './assets';

describe('Asset Utilities', () => {
	describe('generateAssetSlug', () => {
		it('converts filename to lowercase slug', () => {
			const slug = generateAssetSlug('MyFile.pdf');
			expect(slug).toMatch(/^myfile-[a-z0-9]{6}$/);
		});

		it('replaces spaces and special characters with dashes', () => {
			const slug = generateAssetSlug('My Document (2025).pdf');
			expect(slug).toMatch(/^my-document-2025-[a-z0-9]{6}$/);
		});

		it('removes leading/trailing dashes', () => {
			const slug = generateAssetSlug('---test---.pdf');
			expect(slug).toMatch(/^test-[a-z0-9]{6}$/);
		});

		it('limits sanitized part to 50 chars', () => {
			const longName = 'a'.repeat(100) + '.pdf';
			const slug = generateAssetSlug(longName);
			const [base] = slug.split('-').slice(0, -1).join('-').split('-');
			expect(base.length).toBeLessThanOrEqual(50);
		});

		it('generates random slug for empty filenames', () => {
			const slug = generateAssetSlug('...---');
			expect(slug).toMatch(/^asset-[a-z0-9]{7}$/);
		});

		it('handles extension-less files', () => {
			const slug = generateAssetSlug('README');
			expect(slug).toMatch(/^readme-[a-z0-9]{6}$/);
		});

		it('includes timestamp suffix for uniqueness', async () => {
			const slug1 = generateAssetSlug('test.pdf');
			// Wait 1ms to ensure different timestamp
			await new Promise((r) => setTimeout(r, 1));
			const slug2 = generateAssetSlug('test.pdf');
			expect(slug1).not.toBe(slug2);
			expect(slug1.split('-')[0]).toBe(slug2.split('-')[0]);
		});
	});

	describe('resolveAssetReferences', () => {
		it('replaces asset:slug with /assets/slug', () => {
			const text = 'Check [logo](asset:logo)';
			const resolved = resolveAssetReferences(text);
			expect(resolved).toBe('Check [logo](/assets/logo)');
		});

		it('handles multiple asset references', () => {
			const text = '![img](asset:header) and [file](asset:report-pdf)';
			const resolved = resolveAssetReferences(text);
			expect(resolved).toBe('![img](/assets/header) and [file](/assets/report-pdf)');
		});

		it('handles asset references with dashes and numbers', () => {
			const text = 'Download [file](asset:my-report-2025-abc123)';
			const resolved = resolveAssetReferences(text);
			expect(resolved).toBe('Download [file](/assets/my-report-2025-abc123)');
		});

		it('is case-insensitive for asset prefix', () => {
			const text = '[link](ASSET:slug) and [other](Asset:slug2)';
			const resolved = resolveAssetReferences(text);
			expect(resolved).toBe('[link](/assets/slug) and [other](/assets/slug2)');
		});

		it('does not replace non-asset references', () => {
			const text = 'Visit [example](https://example.com) and [home](/home)';
			const resolved = resolveAssetReferences(text);
			expect(resolved).toBe(text);
		});

		it('handles edge case with consecutive asset refs', () => {
			const text = '[a](asset:a) [b](asset:b) [c](asset:c)';
			const resolved = resolveAssetReferences(text);
			expect(resolved).toBe('[a](/assets/a) [b](/assets/b) [c](/assets/c)');
		});

		it('preserves non-matching text', () => {
			const text = 'Some markdown text with [link](asset:logo) and other stuff';
			const resolved = resolveAssetReferences(text);
			expect(resolved).toBe('Some markdown text with [link](/assets/logo) and other stuff');
		});
	});

	describe('canAccessAssets', () => {
		it('returns true for admin users', () => {
			// @ts-expect-error - testing with minimal user object
			expect(canAccessAssets({ globalRole: 'admin' })).toBe(true);
		});

		it('returns false for non-admin users', () => {
			// @ts-expect-error - testing with minimal user object
			expect(canAccessAssets({ globalRole: 'member' })).toBe(false);
		});

		it('returns false for moderators (v1 admin-only)', () => {
			// @ts-expect-error - testing with minimal user object
			expect(canAccessAssets({ globalRole: 'moderator' })).toBe(false);
		});

		it('returns false for null user', () => {
			expect(canAccessAssets(null)).toBe(false);
		});
	});

	describe('getAssetUrl', () => {
		it('returns correct asset URL', () => {
			expect(getAssetUrl('logo')).toBe('/assets/logo');
		});

		it('handles slugs with dashes and numbers', () => {
			expect(getAssetUrl('my-report-2025-abc')).toBe('/assets/my-report-2025-abc');
		});
	});
});
