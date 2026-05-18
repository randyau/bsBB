import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { userNotifications } from '$lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Sign in to view notifications');

	const notifications = await db
		.select()
		.from(userNotifications)
		.where(eq(userNotifications.recipientDid, locals.user.did))
		.orderBy(desc(userNotifications.createdAt))
		.limit(100);

	// Mark all as read on visit
	await db
		.update(userNotifications)
		.set({ isRead: true })
		.where(and(
			eq(userNotifications.recipientDid, locals.user.did),
			eq(userNotifications.isRead, false),
		));

	return { notifications };
};

export const actions: Actions = {
	markAllRead: async ({ locals }) => {
		if (!locals.user) return fail(401, { error: 'Not authenticated' });

		await db
			.update(userNotifications)
			.set({ isRead: true })
			.where(eq(userNotifications.recipientDid, locals.user.did));

		return { success: true };
	},

	deleteAll: async ({ locals }) => {
		if (!locals.user) return fail(401, { error: 'Not authenticated' });

		await db
			.delete(userNotifications)
			.where(eq(userNotifications.recipientDid, locals.user.did));

		return { success: true };
	},
};
