import type { LayoutServerLoad } from './$types.js';
import { db } from '$lib/db';
import { userNotifications } from '$lib/db/schema';
import { and, eq, count } from 'drizzle-orm';

export const load: LayoutServerLoad = async ({ locals }) => {
	let unreadNotificationCount = 0;

	if (locals.user) {
		const [result] = await db
			.select({ count: count() })
			.from(userNotifications)
			.where(and(
				eq(userNotifications.recipientDid, locals.user.did),
				eq(userNotifications.isRead, false),
			));
		unreadNotificationCount = result?.count ?? 0;
	}

	return {
		user: locals.user,
		unreadNotificationCount,
	};
};
