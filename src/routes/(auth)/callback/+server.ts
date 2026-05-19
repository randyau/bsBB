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

		// Auto-sync profile on first login
		const isFirstLogin = !session.handle; // No handle in OAuth session = first login
		if (isFirstLogin) {
			console.log('First login detected, syncing profile...');
			try {
				// Fetch handle from PLC Directory
				const plcRes = await fetch(`https://plc.directory/${did}`, {
					signal: AbortSignal.timeout(5000),
				});

				if (plcRes.ok) {
					const doc = await plcRes.json() as { alsoKnownAs?: string[] };
					const atUri = doc.alsoKnownAs?.find((a: string) => a.startsWith('at://'));
					const handle = atUri ? atUri.replace('at://', '') : null;

					if (handle) {
						// Fetch profile from AppView
						const profileRes = await fetch(
							`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${did}`,
							{ signal: AbortSignal.timeout(5000) }
						);

						if (profileRes.ok) {
							const profile = await profileRes.json() as {
								displayName?: string;
								avatar?: string;
							};

							// Update user with synced profile
							const { db } = await import('$lib/db');
							const { users } = await import('$lib/db/schema');
							const { eq } = await import('drizzle-orm');
							await db
								.update(users)
								.set({
									handle,
									displayName: profile.displayName ?? null,
									avatarUrl: profile.avatar ?? null,
									lastProfileSync: new Date(),
								})
								.where(eq(users.did, did));

							console.log('Profile synced on first login:', handle);
						}
					}
				}
			} catch (err) {
				console.error('Profile sync failed on first login:', err);
				// Don't block login if sync fails
			}
		}

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
