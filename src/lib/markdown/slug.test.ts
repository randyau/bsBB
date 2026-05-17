import { describe, it, expect } from 'vitest';
import { generateSlug } from './slug';

describe('generateSlug — thread title to URL slug', () => {
	it('converts to lowercase', () => {
		expect(generateSlug('Hello World')).toMatch(/^[a-z0-9-]+$/);
	});

	it('replaces spaces with hyphens', () => {
		expect(generateSlug('hello world test')).toBe('hello-world-test');
	});

	it('removes punctuation and special characters', () => {
		expect(generateSlug('What? A: Great!')).toBe('what-a-great');
	});

	it('collapses multiple spaces to single hyphen', () => {
		expect(generateSlug('hello   world')).toBe('hello-world');
	});

	it('collapses multiple hyphens to single hyphen', () => {
		expect(generateSlug('hello---world')).toBe('hello-world');
	});

	it('removes leading and trailing hyphens', () => {
		expect(generateSlug('-hello-world-')).toBe('hello-world');
	});

	it('handles all-punctuation input', () => {
		expect(generateSlug('!!!')).toBe('');
	});

	it('truncates to 80 characters', () => {
		const longTitle = 'a'.repeat(150);
		const slug = generateSlug(longTitle);
		expect(slug.length).toBeLessThanOrEqual(80);
		expect(slug).toBe('a'.repeat(80));
	});

	it('truncates and removes trailing hyphens', () => {
		const title = 'hello-world-' + 'a'.repeat(100);
		const slug = generateSlug(title);
		expect(slug.length).toBeLessThanOrEqual(80);
		expect(slug).not.toMatch(/-$/); // No trailing hyphen
	});

	it('preserves hyphens within the title', () => {
		expect(generateSlug('my-awesome-post')).toBe('my-awesome-post');
	});

	it('handles unicode characters (removes non-word)', () => {
		expect(generateSlug('café naïve')).toBe('caf-nave');
	});

	it('handles numbers', () => {
		expect(generateSlug('Post 2024 Edition')).toBe('post-2024-edition');
	});

	it('handles apostrophes', () => {
		expect(generateSlug("don't worry")).toBe('dont-worry');
	});

	it('handles multiple consecutive special characters', () => {
		expect(generateSlug('hello!!! world??')).toBe('hello-world');
	});

	it('handles single word', () => {
		expect(generateSlug('hello')).toBe('hello');
	});

	it('handles empty string', () => {
		expect(generateSlug('')).toBe('');
	});

	it('handles only spaces', () => {
		expect(generateSlug('   ')).toBe('');
	});
});
