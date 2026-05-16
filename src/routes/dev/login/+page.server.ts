import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/db/index.js';
import { users } from '$lib/db/schema.js';
import { like } from 'drizzle-orm';
import { createSession, setSessionCookie } from '$lib/auth/session.js';
import { env } from '$env/dynamic/private';

// Hard block: this route must never be reachable in production.
function assertDevOnly() {
	if (env.NODE_ENV === 'production') {
		error(404, 'Not found');
	}
	if (env.DEV_AUTH_ENABLED !== 'true') {
		error(404, 'Not found');
	}
}

export const load: PageServerLoad = async () => {
	assertDevOnly();

	const devUsers = await db
		.select({
			did: users.did,
			handle: users.handle,
			displayName: users.displayName,
			globalRole: users.globalRole,
		})
		.from(users)
		// Only show seeded dev users — real DIDs never match did:example:
		// This prevents accidentally impersonating a real user via this route.
		.where(like(users.did, 'did:example:%'));

	return { devUsers };
};

export const actions: Actions = {
	default: async (event) => {
		assertDevOnly();

		const data = await event.request.formData();
		const did = data.get('did');

		if (typeof did !== 'string' || !did.startsWith('did:example:')) {
			error(400, 'Invalid dev user DID');
		}

		const token = await createSession(did);
		setSessionCookie(event, token);

		redirect(302, '/');
	},
};
