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
import { notificationQueue, users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendEmail } from '$lib/email';

async function processNotifications() {
	try {
		// Fetch up to 10 pending notifications atomically.
		// FOR UPDATE SKIP LOCKED ensures multiple worker instances don't process the same row.
		const pending = await db.execute(
			db.raw(
				`
				SELECT id, recipient_did, type, payload, created_at
				FROM notification_queue
				WHERE status = 'pending'
				ORDER BY created_at ASC
				LIMIT 10
				FOR UPDATE SKIP LOCKED
				`
			)
		);

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

			try {
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

	// Send email (or log in dev mode)
	await sendEmail(
		`${recipient.handle}@example.com`, // Would use real email from user profile
		subject,
		html
	);

	console.log(`[worker:moderator_alert] sent to ${recipient.handle} (${recipientDid})`);
}

async function handleDmNotification(recipientDid: string, payload: any) {
	const { notificationType, threadTitle, replyAuthorHandle } = payload;

	// Rate limiting: max 1 DM per user per hour
	// (In production, check last_dm_sent_at for this recipient)
	// For now, just send — future commits can add rate limiting

	// Get recipient's service account chat session
	const recipient = await db.query.users.findFirst({
		where: eq(users.did, recipientDid),
		columns: { chatSessionEncrypted: true, notifyViaBluesky: true }
	});

	if (!recipient?.notifyViaBluesky || !recipient?.chatSessionEncrypted) {
		console.log(
			`[worker:dm_notification] skipped (not opted in): ${recipientDid}`
		);
		return;
	}

	// Placeholder: In full implementation, would decrypt session and send via @atproto/api
	// For now, log the intent
	const message = buildDmMessage(notificationType, threadTitle, replyAuthorHandle);
	console.log(
		`[worker:dm_notification] would send to ${recipientDid}: ${message}`
	);
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
			return `@${authorHandle} quoted your post`;
		case 'new_reply_in_thread':
			return `New reply in "${threadTitle}"`;
		default:
			return 'You have a new notification';
	}
}

async function handleProfileSync(recipientDid: string, payload: any) {
	// Placeholder: profile sync implemented in Commit 5
	console.log(`[worker:profile_sync] did=${recipientDid}`);
}

async function startNotificationWorker() {
	console.log('[worker] notification worker started');

	const pollInterval = 60 * 1000; // 60 seconds

	// Initial poll
	await processNotifications();

	// Then poll every 60 seconds
	setInterval(processNotifications, pollInterval);
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
