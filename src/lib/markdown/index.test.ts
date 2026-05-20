import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderMarkdown, expandQuoteMarkers } from './index';

// Mock the DB
vi.mock('$lib/db', () => ({
	db: {
		query: {
			posts: {
				findFirst: vi.fn()
			},
			users: {
				findFirst: vi.fn()
			}
		}
	}
}));

import { db } from '$lib/db';

describe('renderMarkdown — markdown to sanitized HTML', () => {
	describe('basic markdown rendering', () => {
		it('renders plain text', async () => {
			const html = await renderMarkdown('hello world');
			expect(html).toContain('hello world');
		});

		it('renders bold text', async () => {
			const html = await renderMarkdown('**bold**');
			expect(html).toContain('<strong>bold</strong>');
		});

		it('renders italic text', async () => {
			const html = await renderMarkdown('*italic*');
			expect(html).toContain('<em>italic</em>');
		});

		it('renders headings', async () => {
			const html = await renderMarkdown('# Heading 1');
			expect(html).toContain('<h1>Heading 1</h1>');
		});

		it('renders lists', async () => {
			const html = await renderMarkdown('- item 1\n- item 2');
			expect(html).toContain('<li>item 1</li>');
			expect(html).toContain('<li>item 2</li>');
		});

		it('renders blockquotes', async () => {
			const html = await renderMarkdown('> quoted text');
			expect(html).toContain('<blockquote>');
			expect(html).toContain('quoted text');
		});

		it('renders code blocks', async () => {
			const html = await renderMarkdown('```\ncode here\n```');
			expect(html).toContain('<code>');
			expect(html).toContain('code here');
		});

		it('renders links', async () => {
			const html = await renderMarkdown('[click](https://example.com)');
			expect(html).toContain('href="https://example.com"');
			expect(html).toContain('click');
		});
	});

	describe('HTML sanitization (XSS prevention)', () => {
		it('removes script tags', async () => {
			const html = await renderMarkdown('<script>alert("xss")</script>');
			expect(html).not.toContain('<script>');
			expect(html).not.toContain('alert');
		});

		it('removes onclick handlers', async () => {
			const html = await renderMarkdown('<img onclick="alert(1)" />');
			expect(html).not.toContain('onclick');
		});

		it('removes style attributes with malicious content', async () => {
			const html = await renderMarkdown('<div style="background: url(javascript:alert(1))">');
			// Style should be stripped or sanitized
			expect(html).not.toContain('javascript:');
		});

		it('allows safe HTML tags like strong, em, a', async () => {
			const html = await renderMarkdown('[safe link](https://example.com)');
			expect(html).toContain('<a');
			expect(html).toContain('href=');
		});

		it('removes dangerous protocols from links', async () => {
			const html = await renderMarkdown('[click](javascript:alert(1))');
			expect(html).not.toContain('javascript:');
		});

		it('removes inline event handlers', async () => {
			const html = await renderMarkdown('<a href="https://example.com" onmouseover="alert(1)">link</a>');
			expect(html).not.toContain('onmouseover');
		});
	});

	describe('emoji conversion', () => {
		it('converts shortcodes to unicode emoji', async () => {
			const html = await renderMarkdown('hello :wave:');
			expect(html).toContain('👋');
		});

		it('converts multiple emoji', async () => {
			const html = await renderMarkdown(':smile: :tada: :fire:');
			expect(html).toContain('😄');
			expect(html).toContain('🎉');
			expect(html).toContain('🔥');
		});

		it('ignores unknown shortcodes', async () => {
			const html = await renderMarkdown(':unknowncode:');
			expect(html).toContain(':unknowncode:'); // Unchanged
		});
	});

	describe('quote marker expansion', () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it('expands >!quote markers when DB available', async () => {
			const mocked = vi.mocked(db.query.posts.findFirst);
			mocked.mockResolvedValue({
				authorDid: 'did:plc:author'
			} as any);

			const mocked2 = vi.mocked(db.query.users.findFirst);
			mocked2.mockResolvedValue({
				handle: 'author.bsky.social',
				displayName: 'Author Name'
			} as any);

			const html = await expandQuoteMarkers('>!quote 12345678-1234-1234-1234-123456789012', db);
			expect(html).toContain('Quoting Author Name');
			expect(html).toContain('post-12345678-1234-1234-1234-123456789012');
		});

		it('uses handle as fallback when displayName missing', async () => {
			const mocked = vi.mocked(db.query.posts.findFirst);
			mocked.mockResolvedValue({
				authorDid: 'did:plc:author'
			} as any);

			const mocked2 = vi.mocked(db.query.users.findFirst);
			mocked2.mockResolvedValue({
				handle: 'author.bsky.social',
				displayName: null
			} as any);

			const html = await expandQuoteMarkers('>!quote 12345678-1234-1234-1234-123456789012', db);
			expect(html).toContain('Quoting author.bsky.social');
		});

		it('uses Unknown when both name and handle missing', async () => {
			const mocked = vi.mocked(db.query.posts.findFirst);
			mocked.mockResolvedValue({
				authorDid: 'did:plc:author'
			} as any);

			const mocked2 = vi.mocked(db.query.users.findFirst);
			mocked2.mockResolvedValue({
				handle: null,
				displayName: null
			} as any);

			const html = await expandQuoteMarkers('>!quote 12345678-1234-1234-1234-123456789012', db);
			expect(html).toContain('Quoting Unknown');
		});

		it('returns unchanged markdown when post not found', async () => {
			const mocked = vi.mocked(db.query.posts.findFirst);
			mocked.mockResolvedValue(undefined);

			const markdown = '>!quote 12345678-1234-1234-1234-123456789012';
			const html = await expandQuoteMarkers(markdown, db);
			expect(html).toContain(markdown); // Unchanged
		});

		it('returns unchanged markdown when no DB provided', async () => {
			const markdown = '>!quote 12345678-1234-1234-1234-123456789012';
			const html = await expandQuoteMarkers(markdown);
			expect(html).toBe(markdown);
		});

		it('expands multiple quote markers', async () => {
			const mocked = vi.mocked(db.query.posts.findFirst);
			mocked.mockResolvedValue({
				authorDid: 'did:plc:author'
			} as any);

			const mocked2 = vi.mocked(db.query.users.findFirst);
			mocked2.mockResolvedValue({
				handle: 'author.bsky.social',
				displayName: 'Author'
			} as any);

			const markdown = '>!quote 11111111-1111-1111-1111-111111111111\n>!quote 22222222-2222-2222-2222-222222222222';
			const html = await expandQuoteMarkers(markdown, db);
			expect(html).toContain('Quoting Author');
			expect(html).toContain('post-11111111-1111-1111-1111-111111111111');
			expect(html).toContain('post-22222222-2222-2222-2222-222222222222');
		});
	});

	describe('asset reference resolution', () => {
		it('resolves asset references in links', async () => {
			const html = await renderMarkdown('[download](asset:report-pdf)');
			expect(html).toContain('href="/assets/report-pdf"');
			expect(html).toContain('download</a>');
		});

		it('resolves asset references in images', async () => {
			const html = await renderMarkdown('![logo](asset:my-logo)');
			expect(html).toContain('src="/assets/my-logo"');
			expect(html).toContain('alt="logo"');
		});

		it('resolves multiple asset references', async () => {
			const html = await renderMarkdown('[file1](asset:doc1) and ![img](asset:pic1) and [file2](asset:doc2)');
			expect(html).toContain('href="/assets/doc1"');
			expect(html).toContain('src="/assets/pic1"');
			expect(html).toContain('href="/assets/doc2"');
		});

		it('handles asset references with special characters in slug', async () => {
			const html = await renderMarkdown('[report](asset:annual-report-2025-abc123)');
			expect(html).toContain('href="/assets/annual-report-2025-abc123"');
		});

		it('preserves regular URLs unchanged', async () => {
			const html = await renderMarkdown('[link](https://example.com)');
			expect(html).toContain('href="https://example.com"');
			expect(html).not.toContain('/assets/');
		});

		it('case-insensitive asset prefix', async () => {
			const html1 = await renderMarkdown('[link](asset:slug)');
			const html2 = await renderMarkdown('[link](ASSET:slug)');
			const html3 = await renderMarkdown('[link](Asset:slug)');
			expect(html1).toContain('href="/assets/slug"');
			expect(html2).toContain('href="/assets/slug"');
			expect(html3).toContain('href="/assets/slug"');
		});
	});

	describe('edge cases', () => {
		it('handles empty markdown', async () => {
			const html = await renderMarkdown('');
			expect(html).toBeDefined();
			expect(typeof html).toBe('string');
		});

		it('handles whitespace-only markdown', async () => {
			const html = await renderMarkdown('   \n\n   ');
			expect(html).toBeDefined();
		});

		it('handles long markdown', async () => {
			const longMarkdown = 'paragraph\n\n'.repeat(100);
			const html = await renderMarkdown(longMarkdown);
			expect(html).toBeDefined();
			expect(html.length).toBeGreaterThan(0);
		});

		it('handles mixed markdown and HTML', async () => {
			const html = await renderMarkdown('**bold** and <script>alert(1)</script>');
			expect(html).toContain('<strong>bold</strong>');
			expect(html).not.toContain('<script>');
		});
	});
});
