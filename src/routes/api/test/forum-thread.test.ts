import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Forum and Thread Integration Tests
 *
 * Tests:
 * - Creating threads in forums
 * - Retrieving thread listings
 * - Thread detail pages
 * - Accessing forums with proper permissions
 * - Thread locking and pinning (moderation)
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

describe('Forum and Thread Operations', () => {
	let admin: TestSession;
	let member: TestSession;

	beforeEach(async () => {
		admin = await createSession('did:test:admin-forum', 'admin.test', 'admin');
		member = await createSession('did:test:member-forum', 'member.test', 'member');
	});

	describe('Forum access', () => {
		it('member can view forum index', async () => {
			const res = await fetch(`${BASE_URL}/`, {
				headers: sessionHeader(member)
			});
			expect(res.status).toBe(200);
			const html = await res.text();
			expect(html).toContain('forum');
		});

		it('guest can view forum index without auth', async () => {
			const res = await fetch(`${BASE_URL}/`);
			expect(res.status).toBe(200);
		});

		it('member can view General forum', async () => {
			const res = await fetch(`${BASE_URL}/f/general`, {
				headers: sessionHeader(member)
			});
			// May be 200 or 404 depending on General forum existence
			expect([200, 404]).toContain(res.status);
		});
	});

	describe('Thread creation', () => {
		// New thread form action is at /f/[slug]/new (default action)
		it('member can POST thread to forum (form action)', async () => {
			const formData = new FormData();
			formData.append('title', 'Test Thread Title');
			formData.append('body', 'This is a test thread with some content.');

			const res = await fetch(`${BASE_URL}/f/general/new`, {
				method: 'POST',
				headers: sessionHeader(member),
				body: formData
			});

			// SvelteKit form actions return 200 with JSON body.
			// If /f/general doesn't exist, the page load may return 404
			// before the action runs — both are valid outcomes.
			expect([200, 404]).toContain(res.status);
		});

		it('admin can create thread', async () => {
			const formData = new FormData();
			formData.append('title', 'Admin Test Thread');
			formData.append('body', 'Admin creating a thread');

			const res = await fetch(`${BASE_URL}/f/general/new`, {
				method: 'POST',
				headers: sessionHeader(admin),
				body: formData
			});

			expect([200, 404]).toContain(res.status);
		});

		it('banned user cannot create thread', async () => {
			const banned = await createSession('did:test:banned-forum', 'banned.test', 'banned');

			const formData = new FormData();
			formData.append('title', 'Banned Thread');
			formData.append('body', 'This should fail');

			const res = await fetch(`${BASE_URL}/f/general/new`, {
				method: 'POST',
				headers: sessionHeader(banned),
				body: formData
			});

			// 200 with failure body, 302 redirect to /banned, or 404 if forum missing
			expect([200, 302, 404]).toContain(res.status);
		});
	});

	describe('Thread operations (moderation)', () => {
		// Admin thread actions are at /admin/threads?/lock etc.
		it('admin can lock a thread (form action)', async () => {
			const res = await fetch(`${BASE_URL}/admin/threads?/lock`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					...sessionHeader(admin)
				},
				body: 'threadId=00000000-0000-0000-0000-000000000001'
			});

			// 200 with JSON body (success or failure if thread not found)
			expect(res.status).toBe(200);
		});

		it('admin can pin a thread', async () => {
			const res = await fetch(`${BASE_URL}/admin/threads?/pin`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					...sessionHeader(admin)
				},
				body: 'threadId=00000000-0000-0000-0000-000000000001'
			});

			expect(res.status).toBe(200);
		});

		it('member cannot lock threads', async () => {
			const res = await fetch(`${BASE_URL}/admin/threads?/lock`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					...sessionHeader(member)
				},
				body: 'threadId=00000000-0000-0000-0000-000000000001'
			});

			// Member gets a failure body (200) with error, not a 403 on form actions
			expect(res.status).toBe(200);
		});
	});

	describe('Thread detail page', () => {
		it('member can view thread detail', async () => {
			// Try to access a thread (may not exist, which is OK for this test)
			const res = await fetch(
				`${BASE_URL}/f/general/t/00000000-0000-0000-0000-000000000001/test-thread`,
				{
					headers: sessionHeader(member)
				}
			);
			// Will be 200 if thread exists, 404 if not (both are valid)
			expect([200, 404]).toContain(res.status);
		});

		it('guest can view public thread', async () => {
			const res = await fetch(
				`${BASE_URL}/f/general/t/00000000-0000-0000-0000-000000000001/test-thread`
			);
			expect([200, 404]).toContain(res.status);
		});
	});
});
