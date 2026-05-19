/**
 * Notification enqueueing helpers.
 *
 * When moderation actions occur, create notification records in the database.
 * The worker polls and processes them asynchronously.
 */

import { db } from './db';
import { notificationQueue, userNotifications, users, notificationSubscriptions } from './db/schema';
import { eq, and, lt, sql } from 'drizzle-orm';

const INBOX_MAX_PER_USER = 100;
const INBOX_MAX_AGE_DAYS = 30;

/**
 * Write a notification to the user's in-app inbox.
 * Always fires regardless of DM opt-in status.
 * Enforces a per-user cap: last 30 days, max 100 items.
 * Self-notifications are silently dropped.
 */
export async function writeInboxNotification(
	recipientDid: string,
	type: 'reply' | 'quote' | 'new_reply_in_thread' | 'post_rejected',
	payload: Record<string, unknown>,
	actorDid?: string
) {
	// Don't notify users about their own actions
	if (actorDid && actorDid === recipientDid) return;

	await db.transaction(async (tx) => {
		// Insert the new notification
		await tx.insert(userNotifications).values({ recipientDid, type, payload });

		// Expire entries older than 30 days
		const cutoff = new Date(Date.now() - INBOX_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
		await tx
			.delete(userNotifications)
			.where(and(eq(userNotifications.recipientDid, recipientDid), lt(userNotifications.createdAt, cutoff)));

		// Cap at 100: delete oldest beyond the limit
		// Subquery identifies the 101st-oldest row's created_at for this user
		await tx.execute(sql`
			DELETE FROM user_notifications
			WHERE recipient_did = ${recipientDid}
			  AND id NOT IN (
			    SELECT id FROM user_notifications
			    WHERE recipient_did = ${recipientDid}
			    ORDER BY created_at DESC
			    LIMIT ${INBOX_MAX_PER_USER}
			  )
		`);
	});
}

/**
 * Get all admin/moderator DIDs for a forum.
 * Returns global admins + forum-specific moderators.
 */
export async function getAdminDids(forumId?: string) {
	const rows = await db
		.select({ did: users.did })
		.from(users)
		.where(sql`${users.globalRole} IN ('admin', 'moderator')`);

	return rows.map((r) => r.did);
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
 * Enqueue a user notification.
 * Always writes to the in-app inbox.
 * Also enqueues a DM if the user has opted in and the thread is not muted.
 * Can be overridden by thread-level subscriptions (follow/mute) for DM delivery only.
 */
export async function enqueueDmNotification(
	recipientDid: string,
	notificationType: 'reply' | 'quote' | 'new_reply_in_thread',
	payload: any,
	actorDid?: string
) {
	// Always write to in-app inbox
	await writeInboxNotification(recipientDid, notificationType, payload, actorDid);

	// Check thread-level subscription for DM delivery
	const threadId = payload.threadId;
	if (threadId) {
		const [sub] = await db
			.select({ subscriptionType: notificationSubscriptions.subscriptionType })
			.from(notificationSubscriptions)
			.where(
				and(
					eq(notificationSubscriptions.userDid, recipientDid),
					eq(notificationSubscriptions.threadId, threadId)
				)
			)
			.limit(1);

		if (sub?.subscriptionType === 'mute') {
			return; // Muted: inbox written, no DM
		}

		if (sub?.subscriptionType === 'follow') {
			await db.insert(notificationQueue).values({
				recipientDid,
				type: 'dm_notification',
				payload: { notificationType, ...payload, timestamp: new Date().toISOString() }
			});
			console.log(`[notifications] enqueued DM (followed thread): ${notificationType} to ${recipientDid}`);
			return;
		}
	}

	// Fall through to global DM preference
	const user = await db.query.users.findFirst({
		where: eq(users.did, recipientDid),
		columns: { notifyViaBluesky: true }
	});

	if (!user?.notifyViaBluesky) return;

	await db.insert(notificationQueue).values({
		recipientDid,
		type: 'dm_notification',
		payload: { notificationType, ...payload, timestamp: new Date().toISOString() }
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
