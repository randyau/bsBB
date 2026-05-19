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

		// Upsert user record (create on first login, update profile cache on subsequent)
		await upsertUser(did, session);
		console.log('User upserted');

		// First-admin gate: promote if instance has no admin yet
		const flashAdmin = await claimFirstAdmin(did);
		console.log('First admin claimed:', flashAdmin);

		// Create our own session
		const token = await createSession(did);
		console.log('Session created, token:', token.substring(0, 20) + '...');
		setSessionCookie(event, token);
		console.log('Session cookie set');

		// Store flash message for first-admin banner in the URL
		// Simple approach: redirect with a query param that the layout reads once
		if (flashAdmin) {
			console.log('Redirecting with firstAdmin=1');
			redirect(302, '/?firstAdmin=1');
		}
		console.log('Redirecting to /');
		redirect(302, '/');
	} catch (err) {
		if ((err as { status?: number }).status === 302) throw err; // re-throw redirects
		const message = err instanceof Error ? err.message : 'Unknown error';
		console.error('Callback error:', message);
		error(500, `Authentication failed: ${message}`);
	}
};
