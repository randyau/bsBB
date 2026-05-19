import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { posts, threads, forums, users, modLog, piiRemovalRequests, postRevisions, userForumRoles } from '$lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import { isModerator } from '$lib/auth/roles.js';

async function isModOrAdmin(user: Parameters<typeof isModerator>[0], userDid: string): Promise<boolean> {
	if (isModerator(user)) return true;
	// Forum-specific moderators also get access
	const rows = await db
		.select({ id: userForumRoles.userDid })
		.from(userForumRoles)
		.where(and(eq(userForumRoles.userDid, userDid), eq(userForumRoles.role, 'moderator')))
		.limit(1);
	return rows.length > 0;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Not authenticated');
	const allowed = await isModOrAdmin(locals.user, locals.user.did);
	if (!allowed) throw error(403, 'Moderator access required');

	const pending = await db
		.select({
			id: piiRemovalRequests.id,
			postId: piiRemovalRequests.postId,
			requesterDid: piiRemovalRequests.requesterDid,
			reason: piiRemovalRequests.reason,
			status: piiRemovalRequests.status,
			createdAt: piiRemovalRequests.createdAt,
			postStatus: posts.status,
			postBodyMarkdown: posts.bodyMarkdown,
			postCreatedAt: posts.createdAt,
			threadId: threads.id,
			threadTitle: threads.title,
			threadSlug: threads.slug,
			forumSlug: forums.slug,
			forumName: forums.name,
			authorHandle: users.handle,
			authorDisplayName: users.displayName,
			requesterHandle: users.handle,
		})
		.from(piiRemovalRequests)
		.innerJoin(posts, eq(piiRemovalRequests.postId, posts.id))
		.innerJoin(threads, eq(posts.threadId, threads.id))
		.innerJoin(forums, eq(threads.forumId, forums.id))
		.innerJoin(users, eq(posts.authorDid, users.did))
		.where(eq(piiRemovalRequests.status, 'pending'))
		.orderBy(desc(piiRemovalRequests.createdAt));

	// Fetch requester handles separately (they may differ from post author)
	const withRequesters = await Promise.all(
		pending.map(async (row) => {
			const [requester] = await db
				.select({ handle: users.handle })
				.from(users)
				.where(eq(users.did, row.requesterDid))
				.limit(1);
			return { ...row, requesterHandle: requester?.handle ?? row.requesterDid };
		})
	);

	return { requests: withRequesters };
};

export const actions: Actions = {
	piiWipe: async ({ locals, request }) => {
		if (!locals.user) return fail(401, { error: 'Not authenticated' });
		const allowed = await isModOrAdmin(locals.user, locals.user.did);
		if (!allowed) return fail(403, { error: 'Moderator access required' });

		const form = await request.formData();
		const requestId = String(form.get('requestId') ?? '').trim();
		if (!requestId) return fail(422, { error: 'Request ID required' });

		const [req] = await db
			.select({ id: piiRemovalRequests.id, postId: piiRemovalRequests.postId, status: piiRemovalRequests.status })
			.from(piiRemovalRequests)
			.where(eq(piiRemovalRequests.id, requestId))
			.limit(1);

		if (!req) return fail(404, { error: 'Request not found' });
		if (req.status !== 'pending') return fail(422, { error: 'Request is already resolved' });

		await db.transaction(async (tx) => {
			// Purge revision history
			await tx.delete(postRevisions).where(eq(postRevisions.postId, req.postId));

			// Wipe post content and mark deleted
			await tx.update(posts).set({
				status: 'deleted',
				bodyMarkdown: '',
				bodyHtml: '',
				linkMetadata: null,
				replyToPostId: null,
			}).where(eq(posts.id, req.postId));

			// Resolve the request
			await tx.update(piiRemovalRequests).set({
				status: 'wiped',
				resolvedByDid: locals.user!.did,
				resolvedAt: new Date(),
			}).where(eq(piiRemovalRequests.id, requestId));
		});

		await db.insert(modLog).values({
			moderatorDid: locals.user.did,
			action: 'pii_wipe_post',
			targetPostId: req.postId,
			reason: `PII removal request ${requestId}`,
		});

		return { success: true, action: 'piiWipe' };
	},

	dismiss: async ({ locals, request }) => {
		if (!locals.user) return fail(401, { error: 'Not authenticated' });
		const allowed = await isModOrAdmin(locals.user, locals.user.did);
		if (!allowed) return fail(403, { error: 'Moderator access required' });

		const form = await request.formData();
		const requestId = String(form.get('requestId') ?? '').trim();
		const dismissReason = String(form.get('dismissReason') ?? '').trim();
		if (!requestId) return fail(422, { error: 'Request ID required' });
		if (!dismissReason) return fail(422, { error: 'Dismiss reason required' });

		const [req] = await db
			.select({ id: piiRemovalRequests.id, postId: piiRemovalRequests.postId, status: piiRemovalRequests.status })
			.from(piiRemovalRequests)
			.where(eq(piiRemovalRequests.id, requestId))
			.limit(1);

		if (!req) return fail(404, { error: 'Request not found' });
		if (req.status !== 'pending') return fail(422, { error: 'Request is already resolved' });

		await db.update(piiRemovalRequests).set({
			status: 'dismissed',
			resolvedByDid: locals.user.did,
			resolvedAt: new Date(),
			dismissReason,
		}).where(eq(piiRemovalRequests.id, requestId));

		await db.insert(modLog).values({
			moderatorDid: locals.user.did,
			action: 'dismiss_pii_request',
			targetPostId: req.postId,
			reason: dismissReason,
		});

		return { success: true, action: 'dismiss' };
	},
};
