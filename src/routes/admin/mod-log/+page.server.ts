import type { PageServerLoad } from './$types';
import { db } from '$lib/db';
import { modLog, users, posts, threads } from '$lib/db/schema';
import { eq, desc, or } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url }) => {
	const actionFilter = url.searchParams.get('action');

	let query = db
		.select({
			id: modLog.id,
			createdAt: modLog.createdAt,
			moderatorHandle: users.handle,
			action: modLog.action,
			targetDid: modLog.targetDid,
			targetUserHandle: users.handle,
			targetPostId: modLog.targetPostId,
			targetThreadId: modLog.targetThreadId,
			targetThreadTitle: threads.title,
			reason: modLog.reason
		})
		.from(modLog)
		.innerJoin(users, eq(modLog.moderatorDid, users.did))
		.leftJoin(users, eq(modLog.targetDid, users.did))
		.leftJoin(posts, eq(modLog.targetPostId, posts.id))
		.leftJoin(threads, eq(modLog.targetThreadId, threads.id));

	if (actionFilter) {
		query = query.where(eq(modLog.action, actionFilter));
	}

	const entries = await query.orderBy(desc(modLog.createdAt)).limit(200);

	// Get distinct action types for filter dropdown
	const actionTypes = await db
		.selectDistinct({ action: modLog.action })
		.from(modLog)
		.orderBy(modLog.action);

	return {
		entries,
		actionTypes: actionTypes.map((a) => a.action),
		currentFilter: actionFilter || undefined
	};
};
