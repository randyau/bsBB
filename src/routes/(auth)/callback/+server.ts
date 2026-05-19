import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getAtprotoClient } from '$lib/auth/atproto.js';
import { createSession, setSessionCookie } from '$lib/auth/session.js';
import { upsertUser, claimFirstAdmin } from '$lib/auth/user.js';

export const GET: RequestHandler = async (event) => {
	const params = event.url.searchParams;
	console.log('Callback received with params:', Array.from(params.keys()));

	try {
		const client = await getAtprotoClient();
		console.log('Got OAuth client, calling callback...');
		const { session } = await client.callback(params);
		const did = session.did;
		console.log('OAuth callback successful, DID:', did);

		// Upsert user record (create on first login, update profile cache on subsequent)
		await upsertUser(did, session);
		console.log('User upserted');

		// First-admin gate: promote if instance has no admin yet
		const flashAdmin = await claimFirstAdmin(did);
		console.log('First admin claimed:', flashAdmin);

		// Create our own session
		const token = await createSession(did);
		console.log('Session created, token:', token.substring(0, 20) + '...');

		// Build Set-Cookie header manually (SvelteKit won't apply event.cookies to manual Response)
		const SESSION_COOKIE = 'session';
		const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
		const maxAge = Math.floor(SESSION_DURATION_MS / 1000);
		const secure = process.env.NODE_ENV === 'production' ? 'Secure;' : '';
		const setCookieHeader = `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; ${secure} Max-Age=${maxAge}`;
		console.log('Set-Cookie header:', setCookieHeader.substring(0, 50) + '...');

		// Build redirect URL with optional first-admin flag
		const redirectUrl = flashAdmin ? '/?firstAdmin=1' : '/';
		console.log('Redirecting to:', redirectUrl);

		// Return 302 redirect response with Set-Cookie header
		return new Response(null, {
			status: 302,
			headers: {
				Location: redirectUrl,
				'Set-Cookie': setCookieHeader,
			},
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		console.error('Callback error:', message);
		error(500, `Authentication failed: ${message}`);
	}
};
