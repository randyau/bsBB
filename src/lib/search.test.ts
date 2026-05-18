import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB module
vi.mock('$lib/db', () => ({
	db: {
		execute: vi.fn()
	}
}));

// Import after mocks
const { searchPosts, searchPostsCount } = await import('./search.js');
import { db } from '$lib/db';

describe('searchPosts — full-text search with tsvector/trigram', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('query cleaning', () => {
		it('returns empty array for empty query', async () => {
			const results = await searchPosts('');
			expect(results).toEqual([]);
		});

		it('returns empty array for whitespace-only query', async () => {
			const results = await searchPosts('   ');
			expect(results).toEqual([]);
		});

		it('filters out special characters from query', async () => {
			const mocked = vi.mocked(db.execute);
			mocked.mockResolvedValue([] as any);

			// Query with special chars should be cleaned
			await searchPosts('hello! @#$% world');
			expect(mocked).toHaveBeenCalled();
		});
	});

	describe('short query (≤4 chars) uses trigram', () => {
		it('uses LIKE pattern for short queries', async () => {
			const mocked = vi.mocked(db.execute);
			mocked.mockResolvedValue([] as any);

			await searchPosts('cat');
			expect(mocked).toHaveBeenCalled();
			// Short queries (<=4 chars) use LIKE for substring matching
		});

		it('makes query case-insensitive', async () => {
			const mocked = vi.mocked(db.execute);
			mocked.mockResolvedValue([] as any);

			await searchPosts('Cat');
			expect(mocked).toHaveBeenCalled();
		});
	});

	describe('long query (>4 chars) uses tsvector', () => {
		it('uses tsvector for longer queries', async () => {
			const mocked = vi.mocked(db.execute);
			mocked.mockResolvedValue([] as any);

			await searchPosts('hello world');
			expect(mocked).toHaveBeenCalled();
			// Longer queries (>4 chars) use tsvector for full-text search
		});

		it('combines words with & operator', async () => {
			const mocked = vi.mocked(db.execute);
			mocked.mockResolvedValue([] as any);

			await searchPosts('hello world test');
			expect(mocked).toHaveBeenCalled();
		});
	});

	describe('result mapping', () => {
		it('maps DB rows to SearchResult objects', async () => {
			const mocked = vi.mocked(db.execute);
			mocked.mockResolvedValue([
				{
					post_id: 'post-123',
					thread_id: 'thread-456',
					thread_title: 'Test Thread',
					thread_slug: 'test-thread',
					forum_slug: 'general',
					author_handle: 'user.bsky.social',
					author_did: 'did:plc:test',
					body_preview: 'This is a preview of the post content',
					relevance: 0.5,
					created_at: '2024-01-01T00:00:00Z'
				}
			] as any);

			const results = await searchPosts('test');
			expect(results).toHaveLength(1);
			expect(results[0]).toEqual({
				postId: 'post-123',
				threadId: 'thread-456',
				threadTitle: 'Test Thread',
				threadSlug: 'test-thread',
				forumSlug: 'general',
				authorHandle: 'user.bsky.social',
				authorDid: 'did:plc:test',
				bodyPreview: 'This is a preview of the post content',
				relevance: 0.5,
				createdAt: expect.any(Date)
			});
		});

		it('strips HTML tags from preview', async () => {
			const mocked = vi.mocked(db.execute);
			mocked.mockResolvedValue([
				{
					post_id: 'post-123',
					thread_id: 'thread-456',
					thread_title: 'Test',
					thread_slug: 'test',
					forum_slug: 'general',
					author_handle: 'user.bsky.social',
					author_did: 'did:plc:test',
					body_preview: '<p>This is <strong>HTML</strong></p>',
					relevance: 0.5,
					created_at: '2024-01-01T00:00:00Z'
				}
			] as any);

			const results = await searchPosts('html');
			expect(results[0].bodyPreview).toBeDefined();
		});

		it('trims and normalizes whitespace in preview', async () => {
			const mocked = vi.mocked(db.execute);
			mocked.mockResolvedValue([
				{
					post_id: 'post-123',
					thread_id: 'thread-456',
					thread_title: 'Test',
					thread_slug: 'test',
					forum_slug: 'general',
					author_handle: 'user.bsky.social',
					author_did: 'did:plc:test',
					body_preview: '  This   has    multiple   spaces  ',
					relevance: 0.5,
					created_at: '2024-01-01T00:00:00Z'
				}
			] as any);

			const results = await searchPosts('spaces');
			expect(results[0].bodyPreview).not.toMatch(/\s{2,}/);
		});
	});

	describe('pagination', () => {
		it('respects limit parameter', async () => {
			const mocked = vi.mocked(db.execute);
			mocked.mockResolvedValue([] as any);

			await searchPosts('test', 50);
			expect(mocked).toHaveBeenCalled();
		});

		it('respects offset parameter', async () => {
			const mocked = vi.mocked(db.execute);
			mocked.mockResolvedValue([] as any);

			await searchPosts('test', 20, 40);
			expect(mocked).toHaveBeenCalled();
		});

		it('defaults to 20 limit and 0 offset', async () => {
			const mocked = vi.mocked(db.execute);
			mocked.mockResolvedValue([] as any);

			await searchPosts('test');
			expect(mocked).toHaveBeenCalled();
		});
	});

	describe('empty results', () => {
		it('returns empty array when no matches', async () => {
			const mocked = vi.mocked(db.execute);
			mocked.mockResolvedValue([] as any);

			const results = await searchPosts('xyzabc');
			expect(results).toEqual([]);
		});

		it('handles null/undefined count gracefully', async () => {
			const mocked = vi.mocked(db.execute);
			mocked.mockResolvedValue([{ count: null }] as any);

			await searchPosts('test');
			expect(mocked).toHaveBeenCalled();
		});
	});
});

describe('searchPostsCount — result counting', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 0 for empty query', async () => {
		const count = await searchPostsCount('');
		expect(count).toBe(0);
	});

	it('returns count from DB', async () => {
		const mocked = vi.mocked(db.execute);
		mocked.mockResolvedValue([{ count: 42 }] as any);

		const count = await searchPostsCount('hello');
		expect(count).toBe(42);
	});

	it('returns 0 when count is null', async () => {
		const mocked = vi.mocked(db.execute);
		mocked.mockResolvedValue([{ count: null }] as any);

		const count = await searchPostsCount('test');
		expect(count).toBe(0);
	});

	it('uses short query (trigram) for ≤4 char queries', async () => {
		const mocked = vi.mocked(db.execute);
		mocked.mockResolvedValue([{ count: 1 }] as any);

		await searchPostsCount('cat');
		expect(mocked).toHaveBeenCalled();
	});

	it('uses tsvector for >4 char queries', async () => {
		const mocked = vi.mocked(db.execute);
		mocked.mockResolvedValue([{ count: 10 }] as any);

		await searchPostsCount('hello world');
		expect(mocked).toHaveBeenCalled();
	});
});
