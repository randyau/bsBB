import type { PageServerLoad } from './$types';
import { db } from '$lib/db';
import { forums, threads, users, posts, threadViews } from '$lib/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { canRead } from '$lib/permissions';

const THREADS_PER_PAGE = 20;

export const load: PageServerLoad = async ({ locals, params, url }) => {
	// Find forum by slug
	const forum = await db.query.forums.findFirst({
		where: eq(forums.slug, params.forumSlug),
	});

	if (!forum) {
		throw error(404, 'Forum not found');
	}

	// Check permission
	const canAccess = await canRead(db, forum.id, locals.user);
	if (!canAccess) {
		throw error(403, 'Access denied');
	}

	// Get page number from query params
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
	const offset = (page - 1) * THREADS_PER_PAGE;

	// Count total threads
	const countResult = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(threads)
		.where(eq(threads.forumId, forum.id));

	const totalThreads = countResult[0]?.count || 0;
	const totalPages = Math.ceil(totalThreads / THREADS_PER_PAGE);

	// Load threads with post counts
	const threadList = await db
		.select({
			id: threads.id,
			title: threads.title,
			slug: threads.slug,
			isLocked: threads.isLocked,
			isPinned: threads.isPinned,
			createdAt: threads.createdAt,
			lastPostAt: threads.lastPostAt,
			authorHandle: users.handle,
			authorDisplayName: users.displayName,
			postCount: sql<number>`COUNT(${posts.id}) FILTER (WHERE ${posts.status} = 'active')`,
		})
		.from(threads)
		.innerJoin(users, eq(threads.authorDid, users.did))
		.leftJoin(posts, eq(posts.threadId, threads.id))
		.where(eq(threads.forumId, forum.id))
		.groupBy(threads.id, users.did)
		.orderBy(
			sql`${threads.isPinned} DESC`, // pinned first
			sql`${threads.lastPostAt} DESC` // then by last post time
		)
		.limit(THREADS_PER_PAGE)
		.offset(offset);

	// Load unread status if user is logged in
	let viewedThreads: Record<string, Date> = {};
	if (locals.user) {
		const threadIds = threadList.map((t) => t.id);
		const views = await db
			.select({
				threadId: threadViews.threadId,
				lastViewedAt: threadViews.lastViewedAt,
			})
			.from(threadViews)
			.where(
				and(
					eq(threadViews.userDid, locals.user.did),
					inArray(threadViews.threadId, threadIds),
				),
			);

		views.forEach((view) => {
			viewedThreads[view.threadId] = view.lastViewedAt;
		});
	}

	// Add hasUnread flag to threads
	const threadsWithUnread = threadList.map((thread) => ({
		...thread,
		hasUnread: !viewedThreads[thread.id] || thread.lastPostAt > viewedThreads[thread.id],
	}));

	// Forum statistics
	const [statsResult] = await db
		.select({
			totalPosts: sql<number>`COUNT(${posts.id}) FILTER (WHERE ${posts.status} = 'active')`,
			totalMembers: sql<number>`COUNT(DISTINCT ${posts.authorDid}) FILTER (WHERE ${posts.status} = 'active')`,
			postsThisMonth: sql<number>`COUNT(${posts.id}) FILTER (WHERE ${posts.status} = 'active' AND ${posts.createdAt} >= NOW() - INTERVAL '30 days')`,
		})
		.from(threads)
		.leftJoin(posts, eq(posts.threadId, threads.id))
		.where(eq(threads.forumId, forum.id));

	return {
		forum,
		threads: threadsWithUnread,
		currentPage: page,
		totalPages,
		totalThreads,
		stats: {
			totalThreads: Number(totalThreads),
			totalPosts: Number(statsResult?.totalPosts ?? 0),
			totalMembers: Number(statsResult?.totalMembers ?? 0),
			postsThisMonth: Number(statsResult?.postsThisMonth ?? 0),
		},
	};
};
