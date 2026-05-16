/**
 * Notification enqueueing helpers.
 *
 * When moderation actions occur, create notification records in the database.
 * The worker polls and processes them asynchronously.
 */

import { db } from './db';
import { notificationQueue, users } from './db/schema';
import { eq } from 'drizzle-orm';

/**
 * Get all admin/moderator DIDs for a forum.
 * Returns global admins + forum-specific moderators.
 */
export async function getAdminDids(forumId?: string) {
	// For now, just return global admins (Phase 5 MVP)
	// Later: union with per-forum moderators from user_forum_roles
	const admins = await db
		.select({ did: users.did })
		.from(users)
		.where(eq(users.globalRole, 'admin'));

	return admins.map((a) => a.did);
}

/**
 * Enqueue a moderator alert email notification.
 * Sent to all admins/mods when an action occurs.
 */
export async function enqueueModerationAlert(
	action: string,
	targetType: 'user' | 'post' | 'thread',
	targetId: string,
	targetLabel: string,
	moderatorHandle: string,
	reason?: string
) {
	const adminDids = await getAdminDids();

	for (const did of adminDids) {
		await db.insert(notificationQueue).values({
			recipientDid: did,
			type: 'moderator_alert',
			payload: {
				action,
				targetType,
				targetId,
				targetLabel,
				moderatorHandle,
				reason,
				timestamp: new Date().toISOString()
			}
		});
	}

	console.log(`[notifications] enqueued moderator alert: ${action} by ${moderatorHandle}`);
}

/**
 * Enqueue a user DM notification (opt-in).
 * Sent to opted-in users when they're mentioned or replied to.
 */
export async function enqueueDmNotification(
	recipientDid: string,
	notificationType: 'reply' | 'quote' | 'new_reply_in_thread',
	payload: any
) {
	// Check if user has opted in
	const user = await db.query.users.findFirst({
		where: eq(users.did, recipientDid),
		columns: { notifyViaBluesky: true }
	});

	if (!user?.notifyViaBluesky) {
		return; // User hasn't opted in
	}

	await db.insert(notificationQueue).values({
		recipientDid,
		type: 'dm_notification',
		payload: {
			notificationType,
			...payload,
			timestamp: new Date().toISOString()
		}
	});

	console.log(`[notifications] enqueued DM: ${notificationType} to ${recipientDid}`);
}

/**
 * Enqueue a profile sync task.
 * Worker will re-resolve user's DID and update cached profile data.
 */
export async function enqueueProfileSync(userDid: string) {
	await db.insert(notificationQueue).values({
		recipientDid: userDid,
		type: 'profile_sync',
		payload: {
			timestamp: new Date().toISOString()
		}
	});

	console.log(`[notifications] enqueued profile sync for ${userDid}`);
}
