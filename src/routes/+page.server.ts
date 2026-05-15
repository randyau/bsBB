import type { PageServerLoad } from './$types';
import { db } from '$lib/db';
import { forums, threads } from '$lib/db/schema';
import { eq, isNull, sql } from 'drizzle-orm';
import { canRead } from '$lib/permissions';

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

	// Check if first admin was just promoted
	const flashAdmin = url.searchParams.has('firstAdmin');

	return {
		forums: readableForums,
		flashAdmin,
	};
};
