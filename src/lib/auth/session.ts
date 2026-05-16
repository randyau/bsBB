import { db } from '$lib/db/index.js';
import { sessions, users } from '$lib/db/schema.js';
import { eq, and, gt, lt } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';

export type SessionUser = {
	did: string;
	handle: string;
	displayName: string | null;
	avatarUrl: string | null;
	globalRole: 'admin' | 'member' | 'banned';
};

const SESSION_COOKIE = 'session';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_REFRESH_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000; // refresh if < 15 days remain

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

function generateToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashToken(token: string): Promise<string> {
	const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
	return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function createSession(userDid: string): Promise<string> {
	const token = generateToken();
	const tokenHash = await hashToken(token);
	const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

	await db.insert(sessions).values({
		id: tokenHash,
		userDid,
		expiresAt,
	});

	return token; // raw token goes in the cookie; hash stays in DB
}

export async function validateSession(
	token: string
): Promise<{ user: SessionUser; sessionId: string } | null> {
	const tokenHash = await hashToken(token);
	const now = new Date();

	const result = await db
		.select({
			sessionId: sessions.id,
			expiresAt: sessions.expiresAt,
			did: users.did,
			handle: users.handle,
			displayName: users.displayName,
			avatarUrl: users.avatarUrl,
			globalRole: users.globalRole,
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userDid, users.did))
		.where(and(eq(sessions.id, tokenHash), gt(sessions.expiresAt, now)))
		.limit(1);

	if (result.length === 0) return null;

	const row = result[0];

	// Rolling expiry: extend if less than 15 days remain
	const remaining = row.expiresAt.getTime() - now.getTime();
	if (remaining < SESSION_REFRESH_THRESHOLD_MS) {
		const newExpiry = new Date(Date.now() + SESSION_DURATION_MS);
		await db
			.update(sessions)
			.set({ expiresAt: newExpiry })
			.where(eq(sessions.id, tokenHash));
	}

	// Self-pruning: probabilistic cleanup of expired sessions (1% of requests)
	// This eliminates the need for a separate maintenance cron or worker task.
	// Cleanup rate scales with traffic, ensuring tables stay lean without overhead.
	if (Math.random() < 0.01) {
		// Fire-and-forget; don't await or block the user's request
		db.delete(sessions)
			.where(lt(sessions.expiresAt, now))
			.catch((err) => console.error('[session cleanup error]', err));
	}

	return {
		sessionId: row.sessionId,
		user: {
			did: row.did,
			handle: row.handle,
			displayName: row.displayName,
			avatarUrl: row.avatarUrl,
			globalRole: row.globalRole as 'admin' | 'member' | 'banned',
		},
	};
}

export async function invalidateSession(sessionId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}

// ---------------------------------------------------------------------------
// Cookie helpers (used in server routes and hooks)
// ---------------------------------------------------------------------------

export function setSessionCookie(event: RequestEvent, token: string): void {
	event.cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'strict',
		secure: process.env.NODE_ENV === 'production',
		maxAge: SESSION_DURATION_MS / 1000,
	});
}

export function deleteSessionCookie(event: RequestEvent): void {
	event.cookies.delete(SESSION_COOKIE, { path: '/' });
}

export function getSessionToken(event: RequestEvent): string | undefined {
	return event.cookies.get(SESSION_COOKIE);
}
