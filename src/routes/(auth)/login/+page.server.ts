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

		try {
			const client = await getAtprotoClient();
			const url = await client.authorize(handle, { scope: 'atproto' });
			redirect(302, url.toString());
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error';
			return fail(400, { error: `Could not initiate login: ${message}` });
		}
	},
};
