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
import { notificationQueue, posts, threads, users, sessions, modLog, workerLog } from '$lib/db/schema';
import { eq, and, desc, lt } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { sendEmail } from '$lib/email';
import { getSetting } from '$lib/settings';
import { AtpAgent } from '@atproto/api';

// Sentinel DID used as moderatorDid for system-initiated mod_log entries
const SYSTEM_DID = 'did:system:worker';

// ---------------------------------------------------------------------------
// Structured logging — writes to stdout AND persists errors/warnings to DB
// ---------------------------------------------------------------------------

type LogLevel = 'info' | 'warn' | 'error';

async function wlog(level: LogLevel, message: string, context?: Record<string, unknown>) {
	const prefix = `[worker:${level}]`;
	if (level === 'error') {
		console.error(prefix, message, context ?? '');
	} else if (level === 'warn') {
		console.warn(prefix, message, context ?? '');
	} else {
		console.log(prefix, message, context ?? '');
	}

	if (level === 'warn' || level === 'error') {
		try {
			await db.insert(workerLog).values({ level, message, context: context ?? null });
		} catch {
			// never let logging itself crash the worker
		}
	}
}

// ---------------------------------------------------------------------------
// Notification processing
// ---------------------------------------------------------------------------

async function processNotifications() {
	try {
		const pending = await db.transaction(async (tx) => {
			const rows = await tx.execute(sql`
				SELECT id, recipient_did, type, payload, created_at
				FROM notification_queue
				WHERE status = 'pending'
				ORDER BY created_at ASC
				LIMIT 10
				FOR UPDATE SKIP LOCKED
			`);

			if (!rows || rows.length === 0) return [];

			const ids = (rows as unknown as Array<{ id: string }>).map(r => r.id);
			await tx.execute(sql`
				UPDATE notification_queue
				SET status = 'processing'
				WHERE id = ANY(${sql.raw(`ARRAY[${ids.map(id => `'${id}'`).join(',')}]::uuid[]`)})
			`);

			return rows;
		});

		if (!pending || pending.length === 0) {
			if (process.env.NODE_ENV === 'development') {
				console.debug('[worker] no pending notifications');
			}
			return;
		}

		console.log(`[worker] processing ${pending.length} notifications`);

		for (const row of pending as any[]) {
			const notifId = row.id;
			const recipientDid = row.recipient_did;
			const type = row.type;
			const payload = row.payload;

			try {
				if (type === 'dm_notification') {
					const userPrefs = await db.query.users.findFirst({
						where: eq(users.did, recipientDid),
						columns: { notificationFrequency: true }
					});

					if (userPrefs) {
						const lastSent = await getLastDmSentTime(recipientDid);
						const freqWindow = getFrequencyWindow(userPrefs.notificationFrequency);

						if (lastSent && Date.now() - lastSent.getTime() < freqWindow) {
							console.log(`[worker] deferred (frequency throttled): ${recipientDid}`);
							await db
								.update(notificationQueue)
								.set({ status: 'pending' })
								.where(eq(notificationQueue.id, notifId));
							continue;
						}
					}
				}

				if (type === 'moderator_alert') {
					await handleModeratorAlert(recipientDid, payload);
				} else if (type === 'dm_notification') {
					await handleDmNotification(recipientDid, payload);
				} else if (type === 'welcome_dm') {
					await handleWelcomeDm(recipientDid, payload);
				} else if (type === 'profile_sync') {
					await handleProfileSync(recipientDid, payload);
				} else {
					await wlog('warn', `Unknown notification type: ${type}`, { notifId, recipientDid, type });
				}

				await db
					.update(notificationQueue)
					.set({ status: 'sent', sentAt: new Date(), error: null })
					.where(eq(notificationQueue.id, notifId));

				console.log(`[worker] sent notification ${notifId} (${type}) to ${recipientDid}`);
			} catch (err: any) {
				const errorMessage = formatError(err);
				await wlog('error', `Failed to process notification ${notifId}`, {
					notifId,
					recipientDid,
					type,
					error: errorMessage,
					payload: sanitizePayloadForLog(payload),
				});

				await db
					.update(notificationQueue)
					.set({
						status: 'failed',
						error: errorMessage,
						retryCount: sql`retry_count + 1`,
					})
					.where(eq(notificationQueue.id, notifId));
			}
		}
	} catch (err: any) {
		await wlog('error', 'Unhandled error in processNotifications', { error: formatError(err) });
	}
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleModeratorAlert(recipientDid: string, payload: any) {
	const { action, targetType, targetLabel, moderatorHandle, reason } = payload;

	const recipient = await db.query.users.findFirst({
		where: eq(users.did, recipientDid),
		columns: { handle: true }
	});

	if (!recipient?.handle) {
		throw new Error(`Could not find user ${recipientDid} for email`);
	}

	const subject = `[Forum Alert] ${action} — ${targetLabel}`;
	const html = `
		<h2>Moderation Alert</h2>
		<p><strong>Action:</strong> ${action}</p>
		<p><strong>Target:</strong> ${targetType} — ${targetLabel}</p>
		<p><strong>Moderator:</strong> @${moderatorHandle}</p>
		${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
		<p><small>This is an automated alert from your forum.</small></p>
	`;

	const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_FROM;
	if (!adminEmail) {
		throw new Error('ADMIN_EMAIL or SMTP_FROM must be set to receive moderator alerts');
	}
	await sendEmail(adminEmail, subject, html);

	console.log(`[worker:moderator_alert] sent to ${recipient.handle} (${recipientDid})`);
}

async function handleDmNotification(recipientDid: string, payload: any) {
	const { notificationType, threadTitle, threadSlug, forumSlug, replyAuthorHandle } = payload;

	const recipient = await db.query.users.findFirst({
		where: eq(users.did, recipientDid),
		columns: {
			notifyViaBluesky: true,
			notificationType: true,
			notificationFrequency: true
		}
	});

	if (!recipient) {
		throw new Error(`Recipient user not found: ${recipientDid}`);
	}

	if (!recipient.notifyViaBluesky) {
		console.log(`[worker:dm_notification] skipped (Bluesky DMs disabled): ${recipientDid}`);
		return;
	}

	if (
		(recipient.notificationType === 'replies' && notificationType === 'quote') ||
		(recipient.notificationType === 'quotes' && notificationType === 'reply')
	) {
		console.log(`[worker:dm_notification] skipped (type filtered): ${recipientDid} type=${notificationType}`);
		return;
	}

	const baseUrl = process.env.PUBLIC_BASE_URL ?? '';
	const settingsUrl = `${baseUrl}/settings`;
	const threadLink = threadSlug && forumSlug ? `\n${baseUrl}/f/${forumSlug}/t/${threadSlug}` : '';
	const siteName = await getSetting('site_name', 'bsBB');
	const messageText = buildDmMessage(notificationType, threadTitle, replyAuthorHandle, siteName, threadLink, settingsUrl);

	await sendDm(recipientDid, messageText);
	console.log(`[worker:dm_notification] sent to ${recipientDid}: ${messageText.substring(0, 80)}`);
}

async function sendDm(recipientDid: string, text: string) {
	const serviceHandle = process.env.ATPROTO_SERVICE_HANDLE;
	const serviceAppPassword = process.env.ATPROTO_SERVICE_APP_PASSWORD;
	if (!serviceHandle) throw new Error('ATPROTO_SERVICE_HANDLE env var is not set');
	if (!serviceAppPassword) throw new Error('ATPROTO_SERVICE_APP_PASSWORD env var is not set');

	const serviceAgent = new AtpAgent({ service: 'https://bsky.social' });
	try {
		await serviceAgent.login({ identifier: serviceHandle, password: serviceAppPassword });
	} catch (err: any) {
		throw new Error(`Failed to login as service account "${serviceHandle}": ${err.message}`);
	}

	const serviceDid = serviceAgent.session?.did;
	if (!serviceDid) throw new Error('Service account session has no DID after login');

	// Chat methods are served by api.bsky.chat, not bsky.social — proxy header required
	const chatHeaders = { 'atproto-proxy': 'did:web:api.bsky.chat#bsky_chat' };

	let convoId: string;
	try {
		const convoRes = await serviceAgent.api.chat.bsky.convo.getConvoForMembers(
			{ members: [recipientDid, serviceDid] },
			{ headers: chatHeaders }
		);
		convoId = convoRes.data.convo.id;
	} catch (err: any) {
		throw new Error(`Failed to get/create convo between ${recipientDid} and ${serviceDid}: ${err.message}`);
	}

	try {
		await serviceAgent.api.chat.bsky.convo.sendMessage(
			{ convoId, message: { text } },
			{ headers: chatHeaders }
		);
	} catch (err: any) {
		throw new Error(`Failed to send DM in convo ${convoId}: ${err.message}`);
	}
}

function buildDmMessage(
	type: string,
	threadTitle: string | undefined,
	authorHandle: string | undefined,
	siteName: string,
	threadLink: string,
	settingsUrl: string,
): string {
	const footer = `\n\nTo stop these messages, disable notifications at ${settingsUrl}`;
	switch (type) {
		case 'reply':
			return `[${siteName}] @${authorHandle} replied to your thread "${threadTitle}"${threadLink}${footer}`;
		case 'quote':
			return `[${siteName}] @${authorHandle} quoted your post in "${threadTitle}"${threadLink}${footer}`;
		case 'new_reply_in_thread':
			return `[${siteName}] New reply in "${threadTitle}"${threadLink}${footer}`;
		default:
			return `[${siteName}] You have a new forum notification${footer}`;
	}
}

async function handleWelcomeDm(recipientDid: string, payload: any) {
	const { siteName, settingsUrl } = payload;

	const text =
		`[${siteName}] You've enabled Bluesky DM notifications for ${siteName}.\n\n` +
		`You'll receive a message here when someone replies to your threads or quotes your posts.\n\n` +
		`To change your preferences or disable notifications at any time, visit:\n${settingsUrl}`;

	await sendDm(recipientDid, text);
	console.log(`[worker:welcome_dm] sent to ${recipientDid}`);
}

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

function getFrequencyWindow(frequency: string): number {
	switch (frequency) {
		case 'immediate': return 10 * 60 * 1000;
		case 'hourly':    return 60 * 60 * 1000;
		case 'daily':     return 24 * 60 * 60 * 1000;
		default:          return 10 * 60 * 1000;
	}
}

async function handleProfileSync(recipientDid: string, _payload: any) {
	const user = await db.query.users.findFirst({
		where: eq(users.did, recipientDid),
		columns: { did: true, handle: true }
	});

	if (!user) throw new Error(`User ${recipientDid} not found`);

	const profileRes = await fetch(
		`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${recipientDid}`,
		{ signal: AbortSignal.timeout(5000) }
	);

	if (!profileRes.ok) {
		throw new Error(`Could not fetch ATproto profile for ${recipientDid}: HTTP ${profileRes.status}`);
	}

	const profile = await profileRes.json() as { handle: string; displayName?: string; avatar?: string };

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
}

// ---------------------------------------------------------------------------
// Periodic tasks
// ---------------------------------------------------------------------------

async function autoApproveStalePosts() {
	try {
		const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

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
				await tx.insert(modLog).values({
					moderatorDid: SYSTEM_DID,
					action: 'auto_approve_stale',
					targetPostId: post.id,
					reason: 'Automatically approved after 24 hours in the approval queue',
				});
			});
		}

		console.log(`[worker] auto-approved ${stalePosts.length} posts`);
	} catch (err: any) {
		await wlog('error', 'Auto-approve stale posts failed', { error: formatError(err) });
	}
}

async function cleanupExpiredSessions() {
	try {
		await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
		console.log('[worker] session cleanup complete');
	} catch (err: any) {
		await wlog('error', 'Session cleanup failed', { error: formatError(err) });
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatError(err: unknown): string {
	if (err instanceof Error) {
		return err.stack ? `${err.message}\n${err.stack}` : err.message;
	}
	return String(err);
}

/** Strip large/sensitive fields before logging payload context */
function sanitizePayloadForLog(payload: any): any {
	if (!payload || typeof payload !== 'object') return payload;
	const { ...safe } = payload;
	return safe;
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function startNotificationWorker() {
	await wlog('info', 'Notification worker started');

	const pollInterval = 60 * 1000;

	await processNotifications();
	await autoApproveStalePosts();
	await cleanupExpiredSessions();

	setInterval(processNotifications, pollInterval);
	setInterval(autoApproveStalePosts, 10 * 60 * 1000);
	setInterval(cleanupExpiredSessions, 60 * 60 * 1000);
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

process.on('SIGTERM', () => {
	console.log('[worker] SIGTERM received, shutting down gracefully');
	process.exit(0);
});
