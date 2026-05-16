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
		.select({ name: forums.name, slug: forums.slug })
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
	}
};
