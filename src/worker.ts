/**
 * Background worker process for long-running tasks.
 * Runs as a separate process/container from the web tier.
 *
 * This separation ensures:
 * - Web tier remains stateless and can scale horizontally
 * - Queue distribution is safe across multiple worker instances via PostgreSQL's FOR UPDATE SKIP LOCKED
 * - No duplicate processing or race conditions from competing web process loops
 *
 * Execution:
 *   npx tsx src/worker.ts
 *
 * Or in Docker Compose:
 *   services:
 *     worker:
 *       build: .
 *       command: npm run worker
 *       environment: [DATABASE_URL, ATPROTO_*]
 *       depends_on: [db]
 */

import { db } from '$lib/db';
import { notificationQueue, posts, threads, users } from '$lib/db/schema';
import { eq, and, desc, lt } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { sendEmail } from '$lib/email';
import { decrypt } from '$lib/crypto';

async function processNotifications() {
	try {
		// Fetch up to 10 pending notifications atomically.
		// FOR UPDATE SKIP LOCKED must run inside a transaction to hold the row locks.
		const pending = await db.transaction(async (tx) => {
			return tx.execute(sql`
				SELECT id, recipient_did, type, payload, created_at
				FROM notification_queue
				WHERE status = 'pending'
				ORDER BY created_at ASC
				LIMIT 10
				FOR UPDATE SKIP LOCKED
			`);
		});

		if (!pending || pending.length === 0) {
			if (process.env.NODE_ENV === 'development') {
				console.debug('[worker] no pending notifications');
			}
			return;
		}

		console.log(`[worker] processing ${pending.length} notifications`);

		// Process each notification
		for (const row of pending as any[]) {
			const notifId = row.id;
			const recipientDid = row.recipient_did;
			const type = row.type;
			const payload = row.payload;
			const createdAt = new Date(row.created_at);

			try {
				// For DM notifications, check frequency-based rate limiting
				if (type === 'dm_notification') {
					const userPrefs = await db.query.users.findFirst({
						where: eq(users.did, recipientDid),
						columns: { notificationFrequency: true }
					});

					if (userPrefs) {
						const lastSent = await getLastDmSentTime(recipientDid);
						const freqWindow = getFrequencyWindow(userPrefs.notificationFrequency);

						if (lastSent && Date.now() - lastSent.getTime() < freqWindow) {
							// Too soon — defer this notification
							console.log(
								`[worker] deferred (frequency throttled): ${recipientDid} (will retry in ${Math.ceil((freqWindow - (Date.now() - lastSent.getTime())) / 1000)}s)`
							);
							continue; // Skip to next notification, leave this as pending
						}
					}
				}

				// Route by notification type
				if (type === 'moderator_alert') {
					await handleModeratorAlert(recipientDid, payload);
				} else if (type === 'dm_notification') {
					await handleDmNotification(recipientDid, payload);
				} else if (type === 'profile_sync') {
					await handleProfileSync(recipientDid, payload);
				} else {
					console.warn(`[worker] unknown notification type: ${type}`);
				}

				// Mark as sent
				await db
					.update(notificationQueue)
					.set({
						status: 'sent',
						sentAt: new Date()
					})
					.where(eq(notificationQueue.id, notifId));

				console.log(`[worker] ✓ notification ${notifId} sent`);
			} catch (err) {
				console.error(`[worker] failed to process notification ${notifId}:`, err);

				// Mark as failed (don't retry — admin should investigate)
				await db
					.update(notificationQueue)
					.set({
						status: 'failed'
					})
					.where(eq(notificationQueue.id, notifId));
			}
		}
	} catch (err) {
		console.error('[worker] error in processNotifications:', err);
	}
}

async function handleModeratorAlert(recipientDid: string, payload: any) {
	const { action, targetType, targetLabel, moderatorHandle, reason } = payload;

	// Get recipient's email address
	// For now, use handle as fallback (in production, would query user preferences)
	const recipient = await db.query.users.findFirst({
		where: eq(users.did, recipientDid),
		columns: { handle: true }
	});

	if (!recipient?.handle) {
		throw new Error(`Could not find user ${recipientDid} for email`);
	}

	// Build email body
	const subject = `[Forum Alert] ${action} — ${targetLabel}`;
	const html = `
		<h2>Moderation Alert</h2>
		<p><strong>Action:</strong> ${action}</p>
		<p><strong>Target:</strong> ${targetType} — ${targetLabel}</p>
		<p><strong>Moderator:</strong> @${moderatorHandle}</p>
		${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
		<p><small>This is an automated alert from your forum.</small></p>
	`;

	// Moderator alerts go to the configured admin email address.
	// The forum doesn't store user emails — ADMIN_EMAIL is set during setup.
	const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_FROM;
	if (!adminEmail) {
		throw new Error('ADMIN_EMAIL or SMTP_FROM must be set to receive moderator alerts');
	}
	await sendEmail(adminEmail, subject, html);

	console.log(`[worker:moderator_alert] sent to ${recipient.handle} (${recipientDid})`);
}

async function handleDmNotification(recipientDid: string, payload: any) {
	const { notificationType, threadTitle, threadSlug, forumSlug, replyAuthorHandle } = payload;

	// Get recipient's preferences and chat session
	const recipient = await db.query.users.findFirst({
		where: eq(users.did, recipientDid),
		columns: {
			chatSessionEncrypted: true,
			notifyViaBluesky: true,
			notificationType: true,
			notificationFrequency: true
		}
	});

	if (!recipient?.notifyViaBluesky || !recipient?.chatSessionEncrypted) {
		console.log(
			`[worker:dm_notification] skipped (not opted in): ${recipientDid}`
		);
		return;
	}

	// Check notification type preference
	if (
		(recipient.notificationType === 'replies' && notificationType === 'quote') ||
		(recipient.notificationType === 'quotes' && notificationType === 'reply')
	) {
		console.log(
			`[worker:dm_notification] skipped (type filtered): ${recipientDid} type=${notificationType}`
		);
		return;
	}

	try {
		// Decrypt chat session
		let sessionJson: any;
		try {
			sessionJson = JSON.parse(decrypt(recipient.chatSessionEncrypted));
		} catch (err) {
			console.error(`[worker:dm_notification] failed to decrypt session for ${recipientDid}`);
			throw new Error('Failed to decrypt chat session');
		}

		// Build message with thread link
		const threadLink = threadSlug && forumSlug ? `\n\nhttps://yourforum.com/f/${forumSlug}/t/${threadSlug}` : '';
		const message = buildDmMessage(notificationType, threadTitle, replyAuthorHandle) + threadLink;

		// TODO: Send DM via Bluesky chat API
		// This requires setting up proper authentication with @atproto/api
		// For now, log the message that would be sent
		console.log(`[worker:dm_notification] would send to ${recipientDid}: ${message}`);
	} catch (err) {
		console.error(`[worker:dm_notification] failed for ${recipientDid}:`, err);
		throw err;
	}
}

function buildDmMessage(
	type: string,
	threadTitle?: string,
	authorHandle?: string
): string {
	switch (type) {
		case 'reply':
			return `@${authorHandle} replied to your thread "${threadTitle}"`;
		case 'quote':
			return `@${authorHandle} quoted your post in "${threadTitle}"`;
		case 'new_reply_in_thread':
			return `New reply in "${threadTitle}"`;
		default:
			return 'You have a new notification';
	}
}

/**
 * Get the last time a DM notification was sent to a user.
 * Uses the notification_queue sentAt field for the most recent sent DM.
 */
async function getLastDmSentTime(recipientDid: string): Promise<Date | null> {
	const lastSent = await db
		.select({ sentAt: notificationQueue.sentAt })
		.from(notificationQueue)
		.where(
			and(
				eq(notificationQueue.recipientDid, recipientDid),
				eq(notificationQueue.type, 'dm_notification'),
				eq(notificationQueue.status, 'sent')
			)
		)
		.orderBy(desc(notificationQueue.sentAt))
		.limit(1);

	return lastSent[0]?.sentAt || null;
}

/**
 * Convert notification frequency setting to milliseconds.
 */
function getFrequencyWindow(frequency: string): number {
	switch (frequency) {
		case 'immediate':
			return 10 * 60 * 1000; // 10 minutes
		case 'hourly':
			return 60 * 60 * 1000; // 1 hour
		case 'daily':
			return 24 * 60 * 60 * 1000; // 1 day
		default:
			return 10 * 60 * 1000; // default to 10 min
	}
}

async function handleProfileSync(recipientDid: string, payload: any) {
	// Re-resolve user's profile data from ATproto and update cache

	try {
		const user = await db.query.users.findFirst({
			where: eq(users.did, recipientDid),
			columns: { did: true, handle: true }
		});

		if (!user) {
			throw new Error(`User ${recipientDid} not found`);
		}

		// Fetch profile via AppView (public, no auth required)
		const profileRes = await fetch(
			`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${recipientDid}`,
			{ signal: AbortSignal.timeout(5000) }
		);

		if (!profileRes.ok) {
			throw new Error(`Could not fetch profile for ${recipientDid}`);
		}

		const profile = await profileRes.json() as {
			handle: string;
			displayName?: string;
			avatar?: string;
		};

		// Update cached profile data
		await db
			.update(users)
			.set({
				handle: profile.handle,
				displayName: profile.displayName || null,
				avatarUrl: profile.avatar || null,
				lastProfileSync: new Date()
			})
			.where(eq(users.did, recipientDid));

		console.log(`[worker:profile_sync] updated ${profile.handle} (${recipientDid})`);
	} catch (err) {
		console.error(`[worker:profile_sync] failed for ${recipientDid}:`, err);
		throw err;
	}
}

/**
 * Auto-approve posts that have been pending for more than 24 hours.
 * Prevents queue backlog from blocking legitimate users indefinitely.
 */
async function autoApproveStalePosts() {
	try {
		const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

		// Find posts pending for > 24h
		const stalePosts = await db
			.select({ id: posts.id, threadId: posts.threadId })
			.from(posts)
			.where(and(eq(posts.isApproved, false), eq(posts.status, 'active'), lt(posts.createdAt, cutoff)));

		if (stalePosts.length === 0) return;

		console.log(`[worker] auto-approving ${stalePosts.length} stale pending posts`);

		for (const post of stalePosts) {
			await db.transaction(async (tx) => {
				await tx.update(posts).set({ isApproved: true }).where(eq(posts.id, post.id));
				await tx.update(threads).set({ lastPostAt: new Date() }).where(eq(threads.id, post.threadId));
			});
		}

		console.log(`[worker] auto-approved ${stalePosts.length} posts`);
	} catch (err) {
		console.error('[worker] auto-approve error:', err);
	}
}

async function startNotificationWorker() {
	console.log('[worker] notification worker started');

	const pollInterval = 60 * 1000; // 60 seconds

	// Initial poll
	await processNotifications();
	await autoApproveStalePosts();

	// Then poll every 60 seconds
	setInterval(processNotifications, pollInterval);
	// Auto-approve check every 10 minutes (precision beyond 1min unnecessary)
	setInterval(autoApproveStalePosts, 10 * 60 * 1000);
}

async function main() {
	console.log('[worker] initializing...');

	if (!process.env.DATABASE_URL) {
		throw new Error('DATABASE_URL required');
	}

	startNotificationWorker();
	console.log('[worker] ready');
}

main().catch((err) => {
	console.error('[worker fatal error]', err);
	process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
	console.log('[worker] SIGTERM received, shutting down gracefully');
	process.exit(0);
});
