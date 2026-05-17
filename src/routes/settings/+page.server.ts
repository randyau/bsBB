import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}
	return {
		user: locals.user,
	};
};

export const actions: Actions = {
	updateDisplayName: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: 'Not logged in' });
		}

		const form = await request.formData();
		const displayName = String(form.get('displayName') ?? '').trim();

		if (displayName.length > 100) {
			return fail(422, { error: 'Display name must be 100 characters or less' });
		}

		try {
			await db
				.update(users)
				.set({ displayName: displayName || null })
				.where(eq(users.did, locals.user.did));

			return { success: true };
		} catch (err) {
			console.error('updateDisplayName error:', err);
			return fail(500, { error: 'Failed to update display name' });
		}
	},

	toggleNotifications: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: 'Not logged in' });
		}

		const form = await request.formData();
		const enabled = form.get('enabled') === 'true';

		try {
			await db
				.update(users)
				.set({ notifyViaBluesky: enabled })
				.where(eq(users.did, locals.user.did));

			return { success: true, notifyViaBluesky: enabled };
		} catch (err) {
			console.error('toggleNotifications error:', err);
			return fail(500, { error: 'Failed to update notification settings' });
		}
	}
};
