import type { PageServerLoad } from './$types';
import { db } from '$lib/db';
import { modLog, users, posts, threads } from '$lib/db/schema';
import { eq, desc, ilike, and } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

export const load: PageServerLoad = async ({ url }) => {
	const actionFilter = url.searchParams.get('action');
	const q = url.searchParams.get('q') ?? '';

	const moderatorUser = alias(users, 'moderator');
	const targetUser = alias(users, 'target_user');

	const conditions = [];
	if (actionFilter) conditions.push(eq(modLog.action, actionFilter));
	if (q.trim()) conditions.push(ilike(moderatorUser.handle, `%${q}%`));
	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const baseQuery = db
		.select({
			id: modLog.id,
			createdAt: modLog.createdAt,
			moderatorHandle: moderatorUser.handle,
			action: modLog.action,
			targetDid: modLog.targetDid,
			targetUserHandle: targetUser.handle,
			targetPostId: modLog.targetPostId,
			targetThreadId: modLog.targetThreadId,
			targetThreadTitle: threads.title,
			reason: modLog.reason
		})
		.from(modLog)
		.innerJoin(moderatorUser, eq(modLog.moderatorDid, moderatorUser.did))
		.leftJoin(targetUser, eq(modLog.targetDid, targetUser.did))
		.leftJoin(posts, eq(modLog.targetPostId, posts.id))
		.leftJoin(threads, eq(modLog.targetThreadId, threads.id));

	const entries = await (where
		? baseQuery.where(where)
		: baseQuery
	).orderBy(desc(modLog.createdAt)).limit(200);

	// Get distinct action types for filter dropdown
	const actionTypes = await db
		.selectDistinct({ action: modLog.action })
		.from(modLog)
		.orderBy(modLog.action);

	return {
		entries,
		actionTypes: actionTypes.map((a) => a.action),
		currentFilter: actionFilter || undefined,
		q
	};
};
