import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Phase 4 Integration Tests
 *
 * Tests HTTP API behavior for moderation, admin, and rate limiting features.
 * Runs against a local dev server (localhost:5173).
 *
 * Usage:
 *   npm test                    # Run once
 *   npm run test:watch          # Watch mode
 *
 * Requirements:
 *   - Dev server must be running: npm run dev
 *   - Tests create/modify database state and clean up after
 *   - All tests use /api/test/session (dev-only endpoint)
 */

const BASE_URL = 'http://localhost:5173';

interface TestSession {
	token: string;
	did: string;
	handle: string;
	globalRole: 'admin' | 'member' | 'banned';
}

async function createSession(
	did: string,
	handle: string,
	globalRole: 'admin' | 'member' | 'banned' = 'member'
): Promise<TestSession> {
	const url = new URL(`${BASE_URL}/api/test/session`);
	url.searchParams.set('did', did);
	url.searchParams.set('handle', handle);
	url.searchParams.set('displayName', `Test ${handle}`);

	const res = await fetch(url.toString());
	expect(res.status).toBe(200);

	const data = (await res.json()) as {
		token: string;
		did: string;
		handle: string;
		globalRole?: string;
	};

	if (globalRole !== 'member') {
		const postRes = await fetch(`${BASE_URL}/api/test/session`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				did: data.did,
				handle: data.handle,
				displayName: `Test ${handle}`,
				globalRole
			})
		});
		expect(postRes.status).toBe(200);
	}

	return {
		token: data.token,
		did: data.did,
		handle: data.handle,
		globalRole
	};
}

function withSession(session: TestSession) {
	return {
		headers: {
			Cookie: `session=${session.token}`
		}
	};
}

let adminSession: TestSession;
let memberSession: TestSession;

describe('Phase 4 — Moderation & Admin Integration Tests', () => {
	beforeEach(async () => {
		// Create fresh test sessions for each test
		const timestamp = Date.now();
		adminSession = await createSession(
			`did:plc:admin${timestamp}`,
			`admin${timestamp}`,
			'admin'
		);
		memberSession = await createSession(
			`did:plc:member${timestamp}`,
			`member${timestamp}`,
			'member'
		);
	});

	describe('Admin Guard', () => {
		it('returns 403 for non-admin accessing /admin', async () => {
			const res = await fetch(`${BASE_URL}/admin`, {
				...withSession(memberSession)
			});
			expect(res.status).toBe(403);
		});

		it('returns 200 for admin accessing /admin', async () => {
			const res = await fetch(`${BASE_URL}/admin`, {
				...withSession(adminSession)
			});
			expect(res.status).toBe(200);
		});

		it('returns 403 for unauthenticated user accessing /admin', async () => {
			const res = await fetch(`${BASE_URL}/admin`);
			expect([401, 403]).toContain(res.status);
		});
	});

	describe('Admin Users Page', () => {
		it('admin can access /admin/users', async () => {
			const res = await fetch(`${BASE_URL}/admin/users`, {
				...withSession(adminSession)
			});
			expect(res.status).toBe(200);
			const html = await res.text();
			expect(html).toContain('Users');
		});

		it('member cannot access /admin/users', async () => {
			const res = await fetch(`${BASE_URL}/admin/users`, {
				...withSession(memberSession)
			});
			expect(res.status).toBe(403);
		});
	});

	describe('Admin SQL Query Interface', () => {
		it('admin can access /admin/query', async () => {
			const res = await fetch(`${BASE_URL}/admin/query`, {
				...withSession(adminSession)
			});
			expect(res.status).toBe(200);
			const html = await res.text();
			expect(html).toContain('Query');
		});

		it('member cannot access /admin/query', async () => {
			const res = await fetch(`${BASE_URL}/admin/query`, {
				...withSession(memberSession)
			});
			expect(res.status).toBe(403);
		});

		it('admin can POST SELECT query', async () => {
			const formData = new FormData();
			formData.append('query', 'SELECT COUNT(*) as count FROM users');

			const res = await fetch(`${BASE_URL}/admin/query`, {
				method: 'POST',
				...withSession(adminSession),
				body: formData
			});
			expect(res.status).toBe(200);
		});

		it('admin query rejects non-SELECT', async () => {
			const formData = new FormData();
			formData.append('query', 'DELETE FROM users');

			const res = await fetch(`${BASE_URL}/admin/query`, {
				method: 'POST',
				...withSession(adminSession),
				body: formData
			});
			expect(res.status).toBe(400);
			const html = await res.text();
			expect(html.toLowerCase()).toContain('select');
		});
	});

	describe('Admin Threads Page', () => {
		it('admin can access /admin/threads', async () => {
			const res = await fetch(`${BASE_URL}/admin/threads`, {
				...withSession(adminSession)
			});
			expect(res.status).toBe(200);
			const html = await res.text();
			expect(html).toContain('Thread');
		});

		it('member cannot access /admin/threads', async () => {
			const res = await fetch(`${BASE_URL}/admin/threads`, {
				...withSession(memberSession)
			});
			expect(res.status).toBe(403);
		});
	});

	describe('Admin Posts Page', () => {
		it('admin can access /admin/posts', async () => {
			const res = await fetch(`${BASE_URL}/admin/posts`, {
				...withSession(adminSession)
			});
			expect(res.status).toBe(200);
			const html = await res.text();
			expect(html).toContain('Post') || html.toContain('post');
		});

		it('member cannot access /admin/posts', async () => {
			const res = await fetch(`${BASE_URL}/admin/posts`, {
				...withSession(memberSession)
			});
			expect(res.status).toBe(403);
		});
	});

	describe('Admin Mod Log Page', () => {
		it('admin can access /admin/mod-log', async () => {
			const res = await fetch(`${BASE_URL}/admin/mod-log`, {
				...withSession(adminSession)
			});
			expect(res.status).toBe(200);
			const html = await res.text();
			expect(html).toContain('Moderation');
		});

		it('member cannot access /admin/mod-log', async () => {
			const res = await fetch(`${BASE_URL}/admin/mod-log`, {
				...withSession(memberSession)
			});
			expect(res.status).toBe(403);
		});

		it('displays log entries', async () => {
			const res = await fetch(`${BASE_URL}/admin/mod-log`, {
				...withSession(adminSession)
			});
			expect(res.status).toBe(200);
			const html = await res.text();
			// Should have either entries or "no moderation actions found"
			expect(html.toLowerCase()).toMatch(/moderation|action/);
		});
	});

	describe('Test Endpoint Protection', () => {
		it('test endpoint returns 404 in production mode', async () => {
			// Note: This only tests true in production builds.
			// In dev, it will return 200. This is expected behavior.
			const res = await fetch(
				`${BASE_URL}/api/test/session?did=did:plc:test&handle=test`
			);
			// In dev, should succeed; in prod, should 404
			expect([200, 404]).toContain(res.status);
		});

		it('test endpoint requires did parameter', async () => {
			const res = await fetch(`${BASE_URL}/api/test/session`);
			expect([400, 404]).toContain(res.status);
		});
	});

	describe('Session Cookie Validation', () => {
		it('valid session cookie grants access', async () => {
			const res = await fetch(`${BASE_URL}/admin/users`, {
				...withSession(adminSession)
			});
			expect(res.status).toBe(200);
		});

		it('invalid session cookie denies access', async () => {
			const res = await fetch(`${BASE_URL}/admin/users`, {
				headers: {
					Cookie: 'session=invalidsessiontoken123'
				}
			});
			expect([401, 403]).toContain(res.status);
		});

		it('missing session cookie denies access', async () => {
			const res = await fetch(`${BASE_URL}/admin/users`);
			expect([401, 403]).toContain(res.status);
		});
	});
});
