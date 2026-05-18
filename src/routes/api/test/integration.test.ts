import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Phase 4 Integration Tests
 *
 * Tests HTTP behavior for admin guard, moderation actions, rate limiting, and sessions.
 * Runs against a live dev server at localhost:5173.
 *
 * Run from VS Code terminal (Windows side — NOT from WSL):
 *   npm test
 *
 * Requirements:
 *   - Dev server running: npm run dev
 *   - DB migrated and seeded
 *
 * Lessons learned from manual testing:
 *   - SvelteKit form actions always return HTTP 200; error/success is in the JSON body.
 *     Do NOT assert 4xx on form action POSTs. Assert on body.type === 'failure'/'success'.
 *   - /admin has no root page (+page.svelte), returns 404. Use /admin/users etc.
 *   - createSession via GET does not set globalRole — must use POST for admin sessions.
 *   - Form action URLs use ?/<actionName> suffix (e.g. ?/ban, ?/run, ?/lock).
 *   - windowStart for rate limit buckets must be cast as ::timestamptz — plain Date objects
 *     are not serialized correctly by postgres-js in raw sql templates.
 *   - Rate limit verdict is in returned object (allowed: boolean), not thrown exception.
 */

const BASE_URL = 'http://localhost:5173';

interface TestSession {
	token: string;
	did: string;
}

async function createSession(
	did: string,
	handle: string,
	globalRole: 'admin' | 'member' | 'banned' = 'member'
): Promise<TestSession> {
	// Must use POST to set globalRole — GET endpoint always creates member role
	const res = await fetch(`${BASE_URL}/api/test/session`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ did, handle, displayName: `Test ${handle}`, globalRole })
	});
	expect(res.status, `createSession failed for ${did}`).toBe(200);
	const data = (await res.json()) as { token: string; did: string };
	return { token: data.token, did: data.did };
}

function sessionHeader(session: TestSession) {
	return { headers: { Cookie: `session=${session.token}` } };
}

let admin: TestSession;
let member: TestSession;

describe('Phase 4 — Admin & Moderation Integration Tests', () => {
	beforeEach(async () => {
		const ts = Date.now();
		admin = await createSession(`did:plc:adm${ts}`, `adm${ts}`, 'admin');
		member = await createSession(`did:plc:mem${ts}`, `mem${ts}`, 'member');
	});

	// -------------------------------------------------------------------------
	// Admin Guard
	// -------------------------------------------------------------------------

	describe('Admin guard', () => {
		it('admin can access /admin/users (200)', async () => {
			const res = await fetch(`${BASE_URL}/admin/users`, sessionHeader(admin));
			expect(res.status).toBe(200);
		});

		it('member is denied /admin/users (403)', async () => {
			const res = await fetch(`${BASE_URL}/admin/users`, sessionHeader(member));
			expect(res.status).toBe(403);
		});

		it('unauthenticated is denied /admin/users (403)', async () => {
			const res = await fetch(`${BASE_URL}/admin/users`);
			expect(res.status).toBe(403);
		});

		it('admin can access /admin/threads (200)', async () => {
			const res = await fetch(`${BASE_URL}/admin/threads`, sessionHeader(admin));
			expect(res.status).toBe(200);
		});

		it('admin can access /admin/posts (200)', async () => {
			const res = await fetch(`${BASE_URL}/admin/posts`, sessionHeader(admin));
			expect(res.status).toBe(200);
		});

		it('admin can access /admin/mod-log (200)', async () => {
			const res = await fetch(`${BASE_URL}/admin/mod-log`, sessionHeader(admin));
			expect(res.status).toBe(200);
		});

		it('admin can access /admin/query (200)', async () => {
			const res = await fetch(`${BASE_URL}/admin/query`, sessionHeader(admin));
			expect(res.status).toBe(200);
		});

		it('member is denied all admin sub-pages (403)', async () => {
			const pages = ['/admin/users', '/admin/threads', '/admin/posts', '/admin/mod-log', '/admin/query'];
			for (const page of pages) {
				const res = await fetch(`${BASE_URL}${page}`, sessionHeader(member));
				expect(res.status, `expected 403 for ${page}`).toBe(403);
			}
		});
	});

	// -------------------------------------------------------------------------
	// Admin SQL query interface
	// Note: SvelteKit form actions always return HTTP 200. Success/failure is in
	// the JSON body: { type: 'success' } or { type: 'failure', data: [...] }.
	// Action URL must include the action name: ?/run
	// -------------------------------------------------------------------------

	describe('Admin SQL query interface', () => {
		it('admin can run a SELECT query (body.type === success)', async () => {
			const form = new URLSearchParams({ query: 'SELECT 1 AS ok' });
			const res = await fetch(`${BASE_URL}/admin/query?/run`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Cookie: `session=${admin.token}`
				},
				body: form.toString()
			});
			// SvelteKit form actions return 200 even on fail()
			expect(res.status).toBe(200);
			const body = (await res.json()) as { type: string };
			expect(body.type).toBe('success');
		});

		it('non-SELECT query is rejected (body.type === failure)', async () => {
			const form = new URLSearchParams({ query: 'DELETE FROM users' });
			const res = await fetch(`${BASE_URL}/admin/query?/run`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Cookie: `session=${admin.token}`
				},
				body: form.toString()
			});
			expect(res.status).toBe(200);
			const body = (await res.json()) as { type: string };
			expect(body.type).toBe('failure');
		});

		it('member POSTing to form action gets failure body (not 403 — form actions bypass layout guard)', async () => {
			// SvelteKit form actions do NOT run layout load() first — auth must be checked in the action itself.
			// The action now has its own guard returning fail(403), which SvelteKit encodes as HTTP 200 + body.type=failure.
			const form = new URLSearchParams({ query: 'SELECT 1' });
			const res = await fetch(`${BASE_URL}/admin/query?/run`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Cookie: `session=${member.token}`
				},
				body: form.toString()
			});
			expect(res.status).toBe(200);
			const body = (await res.json()) as { type: string };
			expect(body.type).toBe('failure');
		});
	});

	// -------------------------------------------------------------------------
	// Ban / unban
	// Form action returns 200 with body.type === 'success' or 'failure'.
	// After ban, the user's session should redirect to /banned.
	// -------------------------------------------------------------------------

	describe('Ban / unban', () => {
		it('admin can ban a member (body.type === success)', { timeout: 15000 }, async () => {
			const form = new URLSearchParams({ did: member.did, reason: 'test ban' });
			const res = await fetch(`${BASE_URL}/admin/users?/ban`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Cookie: `session=${admin.token}`
				},
				body: form.toString()
			});
			expect(res.status).toBe(200);
			const body = (await res.json()) as { type: string };
			expect(body.type).toBe('success');
		});

		it('banned session is redirected to /banned', async () => {
			// Ban the member first
			const form = new URLSearchParams({ did: member.did, reason: 'test ban' });
			await fetch(`${BASE_URL}/admin/users?/ban`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Cookie: `session=${admin.token}`
				},
				body: form.toString()
			});

			// Banned user should be redirected to /banned
			const res = await fetch(`${BASE_URL}/f/general`, {
				redirect: 'manual',
				...sessionHeader(member)
			});
			expect(res.status).toBe(302);
			expect(res.headers.get('location')).toBe('/banned');
		});

		it('admin cannot ban themselves', async () => {
			const form = new URLSearchParams({ did: admin.did, reason: 'self ban' });
			const res = await fetch(`${BASE_URL}/admin/users?/ban`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Cookie: `session=${admin.token}`
				},
				body: form.toString()
			});
			expect(res.status).toBe(200);
			const body = (await res.json()) as { type: string };
			expect(body.type).toBe('failure');
		});

		it('admin can unban a member', { timeout: 15000 }, async () => {
			// Ban first
			await fetch(`${BASE_URL}/admin/users?/ban`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Cookie: `session=${admin.token}`
				},
				body: new URLSearchParams({ did: member.did }).toString()
			});
			// Unban
			const res = await fetch(`${BASE_URL}/admin/users?/unban`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Cookie: `session=${admin.token}`
				},
				body: new URLSearchParams({ did: member.did }).toString()
			});
			expect(res.status).toBe(200);
			const body = (await res.json()) as { type: string };
			expect(body.type).toBe('success');
		});
	});

	// -------------------------------------------------------------------------
	// Thread lock / unlock
	// -------------------------------------------------------------------------

	describe('Thread lock / unlock', () => {
		it('admin can lock and unlock a thread', async () => {
			// Get a thread ID via admin query
			const queryForm = new URLSearchParams({ query: 'SELECT id FROM threads LIMIT 1' });
			const queryRes = await fetch(`${BASE_URL}/admin/query?/run`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Cookie: `session=${admin.token}`
				},
				body: queryForm.toString()
			});
			const queryBody = (await queryRes.json()) as { type: string; data: string };
			expect(queryBody.type).toBe('success');

			// Extract thread ID from encoded data array
			// data is a SvelteKit-encoded JSON string; look for a UUID pattern
			const uuidMatch = queryBody.data.match(
				/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
			);
			if (!uuidMatch) {
				// No threads in DB — skip
				return;
			}
			const threadId = uuidMatch[0];

			// Lock
			const lockRes = await fetch(`${BASE_URL}/admin/threads?/lock`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Cookie: `session=${admin.token}`
				},
				body: new URLSearchParams({ threadId }).toString()
			});
			expect(lockRes.status).toBe(200);
			const lockBody = (await lockRes.json()) as { type: string };
			expect(lockBody.type).toBe('success');

			// Unlock
			const unlockRes = await fetch(`${BASE_URL}/admin/threads?/unlock`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Cookie: `session=${admin.token}`
				},
				body: new URLSearchParams({ threadId }).toString()
			});
			expect(unlockRes.status).toBe(200);
			const unlockBody = (await unlockRes.json()) as { type: string };
			expect(unlockBody.type).toBe('success');
		});
	});

	// -------------------------------------------------------------------------
	// Post delete / restore
	// -------------------------------------------------------------------------

	describe('Post delete / restore', () => {
		it('admin can delete and restore a post', async () => {
			// Get a post ID via admin query
			const queryForm = new URLSearchParams({
				query: "SELECT id FROM posts WHERE is_deleted = false LIMIT 1"
			});
			const queryRes = await fetch(`${BASE_URL}/admin/query?/run`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Cookie: `session=${admin.token}`
				},
				body: queryForm.toString()
			});
			const queryBody = (await queryRes.json()) as { type: string; data: string };
			expect(queryBody.type).toBe('success');

			const uuidMatch = queryBody.data.match(
				/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
			);
			if (!uuidMatch) return; // No posts — skip

			const postId = uuidMatch[0];

			// Delete
			const deleteRes = await fetch(`${BASE_URL}/admin/posts?/delete`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Cookie: `session=${admin.token}`
				},
				body: new URLSearchParams({ postId, reason: 'integration test' }).toString()
			});
			expect(deleteRes.status).toBe(200);
			expect(((await deleteRes.json()) as { type: string }).type).toBe('success');

			// Restore
			const restoreRes = await fetch(`${BASE_URL}/admin/posts?/restore`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Cookie: `session=${admin.token}`
				},
				body: new URLSearchParams({ postId }).toString()
			});
			expect(restoreRes.status).toBe(200);
			expect(((await restoreRes.json()) as { type: string }).type).toBe('success');
		});
	});

	// -------------------------------------------------------------------------
	// Rate limiting
	// IMPORTANT: SvelteKit form actions return HTTP 200 even when fail(429) is
	// called. The rate limit error appears in the response body, not the status.
	// Check for "Too many requests" in the HTML body on the 11th request.
	// The rate limit bucket is keyed by DID and resets each hour window.
	// -------------------------------------------------------------------------

	describe('Rate limiting', () => {
		it('blocks thread creation after 10 requests per hour (body contains rate limit message)', async () => {
			const ts = Date.now();
			const rlSession = await createSession(`did:plc:rl${ts}`, `rl${ts}`, 'member');

			// Exhaust 10 allowed requests
			for (let i = 1; i <= 10; i++) {
				await fetch(`${BASE_URL}/f/general/new`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
						Cookie: `session=${rlSession.token}`
					},
					body: new URLSearchParams({ title: `RL Thread ${ts} ${i}`, body: 'test body' }).toString()
				});
			}

			// 11th should be rate limited
			const res = await fetch(`${BASE_URL}/f/general/new`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Cookie: `session=${rlSession.token}`
				},
				body: new URLSearchParams({ title: `RL Thread ${ts} 11`, body: 'test body' }).toString()
			});
			// HTTP status is 200 (SvelteKit form action behavior)
			expect(res.status).toBe(200);
			const html = await res.text();
			expect(html.toLowerCase()).toMatch(/too many requests|rate limit/);
		});
	});

	// -------------------------------------------------------------------------
	// Session validation
	// -------------------------------------------------------------------------

	describe('Session validation', () => {
		it('valid session grants access', async () => {
			const res = await fetch(`${BASE_URL}/admin/users`, sessionHeader(admin));
			expect(res.status).toBe(200);
		});

		it('invalid session token is denied', async () => {
			const res = await fetch(`${BASE_URL}/admin/users`, {
				headers: { Cookie: 'session=invalidtoken000000000000000000000000000000000' }
			});
			expect(res.status).toBe(403);
		});

		it('missing session is denied', async () => {
			const res = await fetch(`${BASE_URL}/admin/users`);
			expect(res.status).toBe(403);
		});
	});

	// -------------------------------------------------------------------------
	// Test session endpoint
	// -------------------------------------------------------------------------

	describe('Test session endpoint', () => {
		it('requires did parameter (GET without did → 400)', async () => {
			const res = await fetch(`${BASE_URL}/api/test/session`);
			expect(res.status).toBe(400);
		});

		it('GET with did creates a member session', async () => {
			const ts = Date.now();
			const res = await fetch(`${BASE_URL}/api/test/session?did=did:plc:gettest${ts}&handle=gettest`);
			expect(res.status).toBe(200);
			const body = (await res.json()) as { success: boolean; token: string };
			expect(body.success).toBe(true);
			expect(body.token).toBeTruthy();
		});

		it('POST with globalRole=admin creates admin session', async () => {
			const ts = Date.now();
			const res = await fetch(`${BASE_URL}/api/test/session`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ did: `did:plc:admintest${ts}`, handle: `admintest${ts}`, globalRole: 'admin' })
			});
			expect(res.status).toBe(200);
			const body = (await res.json()) as { globalRole: string };
			expect(body.globalRole).toBe('admin');
		});
	});
});
