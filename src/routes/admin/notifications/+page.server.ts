import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { notificationQueue, workerLog, users } from '$lib/db/schema';
import { eq, desc, count, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { AtpAgent } from '@atproto/api';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || locals.user.globalRole !== 'admin') {
		return { stats: null, failed: [], workerErrors: [], allUsers: [] };
	}

	const [stats, failed, workerErrors, allUsers] = await Promise.all([
		// Queue status counts
		db
			.select({ status: notificationQueue.status, count: count() })
			.from(notificationQueue)
			.groupBy(notificationQueue.status),

		// Failed notifications with error detail, most recent 100
		db
			.select({
				id: notificationQueue.id,
				recipientDid: notificationQueue.recipientDid,
				recipientHandle: users.handle,
				type: notificationQueue.type,
				payload: notificationQueue.payload,
				error: notificationQueue.error,
				retryCount: notificationQueue.retryCount,
				createdAt: notificationQueue.createdAt,
			})
			.from(notificationQueue)
			.leftJoin(users, eq(notificationQueue.recipientDid, users.did))
			.where(eq(notificationQueue.status, 'failed'))
			.orderBy(desc(notificationQueue.createdAt))
			.limit(100),

		// Worker error/warn log, most recent 200
		db
			.select({
				id: workerLog.id,
				level: workerLog.level,
				message: workerLog.message,
				context: workerLog.context,
				createdAt: workerLog.createdAt,
			})
			.from(workerLog)
			.orderBy(desc(workerLog.createdAt))
			.limit(200),

		// All users for the test-send typeahead
		db
			.select({ did: users.did, handle: users.handle, displayName: users.displayName })
			.from(users)
			.orderBy(users.handle)
			.then((rows) => rows.map((r) => ({ ...r, displayName: r.displayName ?? undefined }))),
	]);

	const statusMap: Record<string, number> = {};
	for (const row of stats) statusMap[row.status] = Number(row.count);

	return { stats: statusMap, failed, workerErrors, allUsers };
};

export const actions: Actions = {
	// Retry a single failed notification by resetting it to pending
	retry: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });

		const form = await request.formData();
		const id = String(form.get('id') ?? '').trim();
		if (!id) return fail(422, { error: 'id is required' });

		await db
			.update(notificationQueue)
			.set({ status: 'pending', error: null })
			.where(eq(notificationQueue.id, id));

		return { success: true, action: 'retry' };
	},

	// Delete a failed notification from the queue
	delete: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });

		const form = await request.formData();
		const id = String(form.get('id') ?? '').trim();
		if (!id) return fail(422, { error: 'id is required' });

		await db.delete(notificationQueue).where(eq(notificationQueue.id, id));
		return { success: true, action: 'delete' };
	},

	// Clear all worker_log entries
	clearLog: async ({ locals }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
		await db.delete(workerLog);
		return { success: true, action: 'clearLog' };
	},

	// Force-send a test DM notification to a specific user, bypassing the queue
	testSend: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });

		const form = await request.formData();
		const recipientDid = String(form.get('recipientDid') ?? '').trim();
		const notificationType = String(form.get('notificationType') ?? 'reply').trim();

		if (!recipientDid) return fail(422, { action: 'testSend', error: 'Recipient is required' });

		const recipient = await db.query.users.findFirst({
			where: eq(users.did, recipientDid),
			columns: { handle: true, notifyViaBluesky: true }
		});

		if (!recipient) return fail(404, { action: 'testSend', error: 'User not found' });
		if (!recipient.notifyViaBluesky) return fail(422, { action: 'testSend', error: `@${recipient.handle} has not enabled Bluesky DM notifications` });

		const serviceHandle = process.env.ATPROTO_SERVICE_HANDLE;
		const serviceAppPassword = process.env.ATPROTO_SERVICE_APP_PASSWORD;
		if (!serviceHandle) return fail(500, { action: 'testSend', error: 'ATPROTO_SERVICE_HANDLE is not configured' });
		if (!serviceAppPassword) return fail(500, { action: 'testSend', error: 'ATPROTO_SERVICE_APP_PASSWORD is not configured' });

		const messageText = buildTestMessage(notificationType, locals.user.handle);

		try {
			const serviceAgent = new AtpAgent({ service: 'https://bsky.social' });
			await serviceAgent.login({ identifier: serviceHandle, password: serviceAppPassword });
			const serviceDid = serviceAgent.session?.did;
			if (!serviceDid) throw new Error('Service account session has no DID after login');

			const convoRes = await serviceAgent.api.chat.bsky.convo.getConvoForMembers({
				members: [recipientDid, serviceDid]
			});
			const convoId = convoRes.data.convo.id;

			await serviceAgent.api.chat.bsky.convo.sendMessage({ convoId, message: { text: messageText } });
		} catch (err: any) {
			return fail(500, { action: 'testSend', error: `Send failed: ${err.message}` });
		}

		return { success: true, action: 'testSend', handle: recipient.handle };
	},
};

function buildTestMessage(type: string, adminHandle: string): string {
	switch (type) {
		case 'reply':               return `[TEST] Someone replied to your thread "Example Thread Title"`;
		case 'quote':               return `[TEST] Someone quoted your post in "Example Thread Title"`;
		case 'new_reply_in_thread': return `[TEST] New reply in "Example Thread Title"`;
		default:                    return `[TEST] Notification test sent by admin @${adminHandle}`;
	}
}
