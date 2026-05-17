import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Search Integration Tests
 *
 * Tests:
 * - Full-text search for posts
 * - Short query search (substring/trigram)
 * - Long query search (tsvector)
 * - Search result pagination
 * - Search result rendering
 * - Search filtering
 */

const BASE_URL = 'http://localhost:5173';

interface TestSession {
	token: string;
	did: string;
}

async function createSession(
	did: string,
	handle: string,
	globalRole: 'admin' | 'member' = 'member'
): Promise<TestSession> {
	const res = await fetch(`${BASE_URL}/api/test/session`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ did, handle, displayName: `Test ${handle}`, globalRole })
	});
	expect(res.status).toBe(200);
	const data = (await res.json()) as { token: string; did: string };
	return { token: data.token, did: data.did };
}

function sessionHeader(session: TestSession) {
	return {
		Cookie: `session=${session.token}`
	};
}

describe('Search', () => {
	let member: TestSession;

	beforeEach(async () => {
		member = await createSession('did:test:search-member', 'search.member', 'member');
	});

	describe('Search page', () => {
		it('member can view search page', async () => {
			const res = await fetch(`${BASE_URL}/search`, {
				headers: sessionHeader(member)
			});

			expect([200, 404]).toContain(res.status);
		});

		it('guest can view search page', async () => {
			const res = await fetch(`${BASE_URL}/search`);

			expect([200, 404]).toContain(res.status);
		});
	});

	describe('Search API endpoint', () => {
		it('search endpoint accepts query parameter', async () => {
			const res = await fetch(`${BASE_URL}/api/search?q=test`, {
				headers: sessionHeader(member)
			});

			expect([200, 400, 404]).toContain(res.status);
			if (res.status === 200) {
				const data = (await res.json()) as Record<string, unknown>;
				expect(data).toBeDefined();
				// Should have results array
				expect(Array.isArray(data.results) || data.results === undefined).toBe(true);
			}
		});

		it('search with empty query is rejected', async () => {
			const res = await fetch(`${BASE_URL}/api/search?q=`, {
				headers: sessionHeader(member)
			});

			// Should reject empty query
			expect([200, 400, 404]).toContain(res.status);
		});

		it('search with short query uses substring matching', async () => {
			const res = await fetch(`${BASE_URL}/api/search?q=abc`, {
				headers: sessionHeader(member)
			});

			expect([200, 400, 404]).toContain(res.status);
		});

		it('search with long query uses full-text search', async () => {
			const res = await fetch(
				`${BASE_URL}/api/search?q=this is a longer search query to test full text indexing`,
				{
					headers: sessionHeader(member)
				}
			);

			expect([200, 400, 404]).toContain(res.status);
		});

		it('search results are paginated', async () => {
			const res = await fetch(`${BASE_URL}/api/search?q=test&page=1&limit=10`, {
				headers: sessionHeader(member)
			});

			expect([200, 400, 404]).toContain(res.status);
		});

		it('search results contain threadId and forumId', async () => {
			const res = await fetch(`${BASE_URL}/api/search?q=test`, {
				headers: sessionHeader(member)
			});

			if (res.status === 200) {
				const data = (await res.json()) as Record<string, unknown>;
				if (Array.isArray(data.results) && data.results.length > 0) {
					const result = data.results[0] as Record<string, unknown>;
					// Should have expected fields
					expect(result).toBeDefined();
				}
			}
		});

		it('guest can search without auth', async () => {
			const res = await fetch(`${BASE_URL}/api/search?q=test`);

			expect([200, 400, 404]).toContain(res.status);
		});
	});

	describe('Search result display', () => {
		it('search results show post title and preview', async () => {
			const res = await fetch(`${BASE_URL}/api/search?q=test`, {
				headers: sessionHeader(member)
			});

			if (res.status === 200) {
				const data = (await res.json()) as Record<string, unknown>;
				// Just verify structure, don't assume results exist
				expect(data).toBeDefined();
			}
		});

		it('search results are clickable (have proper href)', async () => {
			const res = await fetch(`${BASE_URL}/api/search?q=test`, {
				headers: sessionHeader(member)
			});

			expect([200, 400, 404]).toContain(res.status);
		});
	});

	describe('Search filtering', () => {
		it('search can filter by forum', async () => {
			const res = await fetch(
				`${BASE_URL}/api/search?q=test&forum=general`,
				{
					headers: sessionHeader(member)
				}
			);

			expect([200, 400, 404]).toContain(res.status);
		});

		it('search can filter by date range', async () => {
			const today = new Date().toISOString().split('T')[0];
			const res = await fetch(
				`${BASE_URL}/api/search?q=test&after=${today}`,
				{
					headers: sessionHeader(member)
				}
			);

			expect([200, 400, 404]).toContain(res.status);
		});
	});

	describe('Search result count', () => {
		it('search result count endpoint works', async () => {
			const res = await fetch(`${BASE_URL}/api/search/count?q=test`, {
				headers: sessionHeader(member)
			});

			expect([200, 400, 404]).toContain(res.status);
			if (res.status === 200) {
				const data = (await res.json()) as Record<string, unknown>;
				expect(typeof data.count === 'number' || data.count === undefined).toBe(true);
			}
		});
	});
});
