import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { users, posts, sessions, modLog } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}
	console.log('[settings load] returning user data, notifyViaBluesky:', locals.user.notifyViaBluesky);
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
	},

	updateNotificationPreferences: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: 'Not logged in' });
		}

		const form = await request.formData();
		const notificationType = String(form.get('notificationType') ?? 'both').trim();
		const notificationFrequency = String(form.get('notificationFrequency') ?? 'immediate').trim();

		const validTypes = ['both', 'replies', 'quotes'];
		const validFrequencies = ['immediate', 'hourly', 'daily'];

		if (!validTypes.includes(notificationType)) {
			return fail(422, { error: 'Invalid notification type' });
		}
		if (!validFrequencies.includes(notificationFrequency)) {
			return fail(422, { error: 'Invalid notification frequency' });
		}

		try {
			await db
				.update(users)
				.set({ notificationType, notificationFrequency })
				.where(eq(users.did, locals.user.did));

			return { success: true };
		} catch (err) {
			console.error('updateNotificationPreferences error:', err);
			return fail(500, { error: 'Failed to update notification preferences' });
		}
	},

	deleteAllPosts: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: 'Not logged in' });
		}

		const form = await request.formData();
		const confirm = form.get('confirm') === 'true';

		if (!confirm) {
			return fail(422, { error: 'Deletion not confirmed' });
		}

		try {
			// Mark all posts as deleted
			await db.update(posts).set({ status: 'deleted' }).where(eq(posts.authorDid, locals.user.did));

			// Log the action
			await db.insert(modLog).values({
				moderatorDid: locals.user.did,
				action: 'delete_all_posts',
				targetDid: locals.user.did
			});

			return { success: true, action: 'deleteAllPosts' };
		} catch (err) {
			console.error('deleteAllPosts error:', err);
			return fail(500, { error: 'Failed to delete posts' });
		}
	},

	deleteAccount: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: 'Not logged in' });
		}

		const form = await request.formData();
		const confirm = form.get('confirm') === 'true';
		const confirmHandle = String(form.get('confirmHandle') ?? '').trim();

		if (!confirm || confirmHandle !== locals.user.handle) {
			return fail(422, { error: 'Deletion not confirmed' });
		}

		try {
			// Overwrite user data to anonymize
			await db.update(users).set({
				handle: `deleted-${locals.user.did.substring(0, 8)}`,
				displayName: '[Deleted]',
				avatarUrl: null,
				globalRole: 'member',
				notifyViaBluesky: false,
				chatSessionEncrypted: null
			}).where(eq(users.did, locals.user.did));

			// Delete all sessions for this user
			await db.delete(sessions).where(eq(sessions.userDid, locals.user.did));

			// Log the action
			await db.insert(modLog).values({
				moderatorDid: locals.user.did,
				action: 'delete_account',
				targetDid: locals.user.did
			});

			// Redirect to login
			throw redirect(302, '/login');
		} catch (err) {
			if (err instanceof Error && err.message.includes('redirect')) {
				throw err;
			}
			console.error('deleteAccount error:', err);
			return fail(500, { error: 'Failed to delete account' });
		}
	}
};
