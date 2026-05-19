import { redirect, error } from '@sveltejs/kit';
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
		console.log('Session object keys:', Object.keys(session));
		console.log('Session handle:', (session as any).handle);
		console.log('Session displayName:', (session as any).displayName);
		console.log('Session avatar:', (session as any).avatar);

		// Upsert user record (create on first login, update profile cache on subsequent)
		await upsertUser(did, session);
		console.log('User upserted');

		// First-admin gate: promote if instance has no admin yet
		const flashAdmin = await claimFirstAdmin(did);
		console.log('First admin claimed:', flashAdmin);

		// Create our own session
		const token = await createSession(did);
		console.log('Session created, token:', token.substring(0, 20) + '...');

		// Set session cookie (SvelteKit preserves this through redirect)
		setSessionCookie(event, token);
		console.log('Session cookie set');

		// Redirect to home, with first-admin flag if applicable
		const redirectUrl = flashAdmin ? '/?firstAdmin=1' : '/';
		console.log('Redirecting to:', redirectUrl);
		redirect(302, redirectUrl);
	} catch (err) {
		// Re-throw SvelteKit's redirect error (throws when redirect() is called)
		if ((err as { status?: number }).status === 302) throw err;
		const message = err instanceof Error ? err.message : 'Unknown error';
		console.error('Callback error:', message);
		error(500, `Authentication failed: ${message}`);
	}
};
