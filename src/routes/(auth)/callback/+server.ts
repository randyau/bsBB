import { redirect, error, isRedirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getAtprotoClient } from '$lib/auth/atproto.js';
import { createSession, setSessionCookie } from '$lib/auth/session.js';
import { upsertUser, claimFirstAdmin } from '$lib/auth/user.js';
import { logger as rootLogger } from '$lib/logger.js';

const log = rootLogger.child({ module: 'auth:callback' });

export const GET: RequestHandler = async (event) => {
	const params = event.url.searchParams;
	log.debug({ paramKeys: Array.from(params.keys()) }, 'callback received');

	try {
		const client = await getAtprotoClient();
		const { session } = await client.callback(params);
		const did = session.did;
		log.debug({ did, handle: (session as any).handle, displayName: (session as any).displayName, avatar: (session as any).avatar }, 'OAuth session resolved');

		// Upsert user record (create on first login, update profile cache on subsequent)
		await upsertUser(did, session);

		// Auto-sync profile on first login
		const isFirstLogin = !(session as any).handle; // No handle in OAuth session = first login
		if (isFirstLogin) {
			log.debug('first login detected, syncing profile');
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

							log.debug({ handle }, 'profile synced on first login');
						}
					}
				}
			} catch (err) {
				log.warn({ err }, 'profile sync failed on first login');
				// Don't block login if sync fails
			}
		}

		// First-admin gate: promote if instance has no admin yet
		const flashAdmin = await claimFirstAdmin(did);

		// Create our own session
		const token = await createSession(did);
		log.debug({ tokenPrefix: token.substring(0, 8) + '...' }, 'session created');

		// Set session cookie (SvelteKit preserves this through redirect)
		setSessionCookie(event, token);

		// Log the successful authentication
		log.info({ did, firstAdmin: flashAdmin }, 'user authenticated');

		// Redirect to home, with first-admin flag if applicable
		const redirectUrl = flashAdmin ? '/?firstAdmin=1' : '/';
		redirect(302, redirectUrl);
	} catch (err) {
		// Re-throw SvelteKit's redirect error (throws when redirect() is called)
		if (isRedirect(err)) throw err;
		const message = err instanceof Error ? err.message : 'Unknown error';
		log.error({ err }, 'OAuth callback error');
		error(500, `Authentication failed: ${message}`);
	}
};
