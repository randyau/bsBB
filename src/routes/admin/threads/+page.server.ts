import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { threads, forums, users, posts, modLog } from '$lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
	const threadList = await db
		.select({
			id: threads.id,
			title: threads.title,
			slug: threads.slug,
			forumName: forums.name,
			forumSlug: forums.slug,
			authorHandle: users.handle,
			authorDid: users.did,
			isLocked: threads.isLocked,
			isPinned: threads.isPinned,
			createdAt: threads.createdAt,
			lastPostAt: threads.lastPostAt,
			postCount: sql<number>`COUNT(${posts.id})`
		})
		.from(threads)
		.innerJoin(forums, eq(threads.forumId, forums.id))
		.innerJoin(users, eq(threads.authorDid, users.did))
		.leftJoin(posts, eq(threads.id, posts.threadId))
		.groupBy(threads.id, forums.name, forums.slug, users.handle, users.did)
		.orderBy(desc(threads.lastPostAt));

	return {
		threads: threadList
	};
};

export const actions: Actions = {
	lock: async ({ locals, request }) => {
		const form = await request.formData();
		const threadId = String(form.get('threadId') ?? '').trim();

		if (!threadId) return fail(422, { error: 'Thread ID is required' });

		try {
			await db.update(threads).set({ isLocked: true }).where(eq(threads.id, threadId));

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'lock_thread',
				targetThreadId: threadId
			});

			return { success: true, action: 'lock', threadId };
		} catch (err) {
			return fail(500, { error: 'Failed to lock thread' });
		}
	},

	unlock: async ({ locals, request }) => {
		const form = await request.formData();
		const threadId = String(form.get('threadId') ?? '').trim();

		if (!threadId) return fail(422, { error: 'Thread ID is required' });

		try {
			await db.update(threads).set({ isLocked: false }).where(eq(threads.id, threadId));

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'unlock_thread',
				targetThreadId: threadId
			});

			return { success: true, action: 'unlock', threadId };
		} catch (err) {
			return fail(500, { error: 'Failed to unlock thread' });
		}
	},

	pin: async ({ locals, request }) => {
		const form = await request.formData();
		const threadId = String(form.get('threadId') ?? '').trim();

		if (!threadId) return fail(422, { error: 'Thread ID is required' });

		try {
			await db.update(threads).set({ isPinned: true }).where(eq(threads.id, threadId));

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'pin_thread',
				targetThreadId: threadId
			});

			return { success: true, action: 'pin', threadId };
		} catch (err) {
			return fail(500, { error: 'Failed to pin thread' });
		}
	},

	unpin: async ({ locals, request }) => {
		const form = await request.formData();
		const threadId = String(form.get('threadId') ?? '').trim();

		if (!threadId) return fail(422, { error: 'Thread ID is required' });

		try {
			await db.update(threads).set({ isPinned: false }).where(eq(threads.id, threadId));

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'unpin_thread',
				targetThreadId: threadId
			});

			return { success: true, action: 'unpin', threadId };
		} catch (err) {
			return fail(500, { error: 'Failed to unpin thread' });
		}
	}
};
