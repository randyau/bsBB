import type { PageServerLoad } from './$types';
import { db } from '$lib/db';
import { forums, threads, threadViews } from '$lib/db/schema';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { canRead } from '$lib/permissions';
import { getSetting } from '$lib/settings';
import { renderMarkdown } from '$lib/markdown';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Get all top-level forums
	const allForums = await db.query.forums.findMany({
		where: isNull(forums.parentId),
		orderBy: (f) => f.sortOrder,
	});

	// Filter by permission and add thread counts
	const readableForums = [];

	for (const forum of allForums) {
		const canAccess = await canRead(db, forum.id, locals.user);
		if (!canAccess) continue;

		// Count threads in this forum
		const threadResult = await db
			.select({ count: sql<number>`COUNT(*)` })
			.from(threads)
			.where(eq(threads.forumId, forum.id));

		const threadCount = threadResult[0]?.count || 0;

		readableForums.push({
			...forum,
			threadCount,
		});
	}

	// Compute per-forum unread status for logged-in users
	const forumUnreadSet = new Set<string>();
	if (locals.user && readableForums.length > 0) {
		const forumIds = readableForums.map((f) => f.id);
		const unreadForums = await db
			.select({ forumId: threads.forumId })
			.from(threads)
			.leftJoin(
				threadViews,
				and(
					eq(threadViews.threadId, threads.id),
					eq(threadViews.userDid, locals.user.did),
				),
			)
			.where(
				and(
					inArray(threads.forumId, forumIds),
					sql`(${threadViews.lastViewedAt} IS NULL OR ${threads.lastPostAt} > ${threadViews.lastViewedAt})`,
				),
			)
			.groupBy(threads.forumId);

		for (const row of unreadForums) {
			if (row.forumId) forumUnreadSet.add(row.forumId);
		}
	}

	// Check if first admin was just promoted
	const flashAdmin = url.searchParams.has('firstAdmin');

	// Load and render homepage announcement
	const announcementMarkdown = await getSetting('homepage_announcement', '');
	const announcementHtml = announcementMarkdown ? await renderMarkdown(announcementMarkdown, db) : '';

	return {
		forums: readableForums.map((f) => ({ ...f, hasUnread: forumUnreadSet.has(f.id) })),
		flashAdmin,
		announcementHtml,
	};
};
