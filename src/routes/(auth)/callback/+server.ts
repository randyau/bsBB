import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getAtprotoClient } from '$lib/auth/atproto.js';
import { createSession, setSessionCookie } from '$lib/auth/session.js';
import { upsertUser, claimFirstAdmin } from '$lib/auth/user.js';

export const GET: RequestHandler = async (event) => {
	const params = event.url.searchParams;

	try {
		const client = await getAtprotoClient();
		const { session } = await client.callback(params);
		const did = session.did;

		// Upsert user record (create on first login, update profile cache on subsequent)
		await upsertUser(did, session);

		// First-admin gate: promote if instance has no admin yet
		const flashAdmin = await claimFirstAdmin(did);

		// Create our own session
		const token = await createSession(did);
		setSessionCookie(event, token);

		// Store flash message for first-admin banner in the URL
		// Simple approach: redirect with a query param that the layout reads once
		if (flashAdmin) {
			redirect(302, '/?firstAdmin=1');
		}
		redirect(302, '/');
	} catch (err) {
		if ((err as { status?: number }).status === 302) throw err; // re-throw redirects
		const message = err instanceof Error ? err.message : 'Unknown error';
		error(500, `Authentication failed: ${message}`);
	}
};
