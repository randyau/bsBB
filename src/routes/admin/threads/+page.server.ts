import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { threads, forums, users, posts, modLog } from '$lib/db/schema';
import { eq, desc, sql, and, gte, count, ilike, or } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

const PAGE_SIZE = 25;

export const load: PageServerLoad = async ({ url }) => {
	const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
	const forumFilter = url.searchParams.get('forum') ?? '';
	const period = url.searchParams.get('period') ?? 'all';
	const q = url.searchParams.get('q') ?? '';

	const cutoffMs: Record<string, number | null> = {
		week: Date.now() - 7 * 86400000,
		month: Date.now() - 30 * 86400000,
		year: Date.now() - 365 * 86400000,
		all: null
	};
	const cutoff = cutoffMs[period] ?? null;

	const conditions = [];
	if (forumFilter) conditions.push(eq(forums.slug, forumFilter));
	if (cutoff) conditions.push(gte(threads.lastPostAt, new Date(cutoff)));
	if (q.trim()) conditions.push(or(ilike(threads.title, `%${q}%`), ilike(users.handle, `%${q}%`)));
	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const [{ total }] = await db
		.select({ total: count() })
		.from(threads)
		.innerJoin(forums, eq(threads.forumId, forums.id))
		.innerJoin(users, eq(threads.authorDid, users.did))
		.where(where);

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
		.where(where)
		.groupBy(threads.id, forums.name, forums.slug, users.handle, users.did)
		.orderBy(desc(threads.lastPostAt))
		.limit(PAGE_SIZE)
		.offset((page - 1) * PAGE_SIZE);

	const forumList = await db
		.select({ id: forums.id, name: forums.name, slug: forums.slug })
		.from(forums)
		.orderBy(forums.name);

	return {
		threads: threadList,
		forums: forumList,
		page,
		pageSize: PAGE_SIZE,
		total: Number(total),
		forumFilter,
		period,
		q
	};
};

export const actions: Actions = {
	lock: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
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
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
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
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
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
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
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
	},

	moveThread: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
		const form = await request.formData();
		const threadId = String(form.get('threadId') ?? '').trim();
		const destForumId = String(form.get('destForumId') ?? '').trim();

		if (!threadId || !destForumId) return fail(422, { error: 'Thread ID and destination forum are required' });

		try {
			// Verify destination forum exists
			const [destForum] = await db
				.select({ id: forums.id, slug: forums.slug })
				.from(forums)
				.where(eq(forums.id, destForumId))
				.limit(1);

			if (!destForum) {
				return fail(422, { error: 'Destination forum not found' });
			}

			// Get current forum info for reason field
			const [thread] = await db
				.select({ forumId: threads.forumId })
				.from(threads)
				.where(eq(threads.id, threadId))
				.limit(1);

			if (!thread) {
				return fail(422, { error: 'Thread not found' });
			}

			const [currentForum] = await db
				.select({ slug: forums.slug })
				.from(forums)
				.where(eq(forums.id, thread.forumId))
				.limit(1);

			// Move thread to new forum
			await db
				.update(threads)
				.set({ forumId: destForumId })
				.where(eq(threads.id, threadId));

			// Log the action with source and destination info
			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'move_thread',
				targetThreadId: threadId,
				reason: `from: ${currentForum?.slug || 'unknown'}, to: ${destForum.slug}`
			});

			return { success: true, action: 'moveThread', threadId };
		} catch (err) {
			console.error('moveThread error:', err);
			return fail(500, { error: 'Failed to move thread' });
		}
	},

	// Bulk action: lock, unlock, pin, or unpin multiple threads at once
	bulkAction: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
		const form = await request.formData();
		const action = String(form.get('action') ?? '').trim();
		const threadIdString = String(form.get('threadIds') ?? '').trim();

		if (!action || !threadIdString) return fail(422, { error: 'Action and thread IDs required' });

		const threadIds = threadIdString.split(',').filter(id => id.trim());
		if (threadIds.length === 0) return fail(422, { error: 'No threads selected' });

		try {
			// Validate all threads exist
			const validThreads = await db
				.select({ id: threads.id })
				.from(threads)
				.where(db.sql`${threads.id} IN (${db.sql.join(threadIds, db.sql`, `)})`);

			if (validThreads.length === 0) return fail(422, { error: 'No valid threads found' });

			if (action === 'lock') {
				// Lock all selected threads
				await db.update(threads).set({ isLocked: true }).where(db.sql`${threads.id} IN (${db.sql.join(threadIds, db.sql`, `)})`);

				// Log each action individually for audit trail
				for (const threadId of validThreads.map(t => t.id)) {
					await db.insert(modLog).values({
						moderatorDid: locals.user!.did,
						action: 'lock_thread',
						targetThreadId: threadId
					});
				}
			} else if (action === 'unlock') {
				// Unlock all selected threads
				await db.update(threads).set({ isLocked: false }).where(db.sql`${threads.id} IN (${db.sql.join(threadIds, db.sql`, `)})`);

				// Log each action individually
				for (const threadId of validThreads.map(t => t.id)) {
					await db.insert(modLog).values({
						moderatorDid: locals.user!.did,
						action: 'unlock_thread',
						targetThreadId: threadId
					});
				}
			}

			return { success: true, action: `bulk_${action}`, count: validThreads.length };
		} catch (err) {
			console.error('bulkAction error:', err);
			return fail(500, { error: 'Failed to perform bulk action' });
		}
	}
};
