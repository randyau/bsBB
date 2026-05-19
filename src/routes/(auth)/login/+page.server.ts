import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import { getAtprotoClient } from '$lib/auth/atproto.js';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = () => ({
	devAuthEnabled: env.NODE_ENV !== 'production' && env.DEV_AUTH_ENABLED === 'true',
});

export const actions: Actions = {
	default: async ({ request }) => {
		const data = await request.formData();
		const handle = (data.get('handle') as string | null)?.trim();

		if (!handle) {
			return fail(400, { error: 'Please enter your Bluesky handle.' });
		}

		const client = await getAtprotoClient();
		let authUrl: string;

		try {
			authUrl = String(await client.authorize(handle, { scope: 'atproto' }));
		} catch (err) {
			// authorize() may throw a redirect-like object instead of returning
			if (
				err &&
				typeof err === 'object' &&
				'location' in err &&
				typeof err.location === 'string'
			) {
				authUrl = (err as any).location;
			} else {
				const message = err instanceof Error ? err.message : JSON.stringify(err);
				console.error('OAuth authorize error:', message);
				return fail(400, { error: `Could not initiate login: ${message}` });
			}
		}

		// Redirect to OAuth provider
		redirect(302, authUrl);
	},
};
