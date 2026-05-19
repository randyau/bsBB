import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { posts, threads, forums, users, modLog } from '$lib/db/schema';
import { isModerator } from '$lib/auth/roles.js';
import { eq, and } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { writeInboxNotification } from '$lib/notifications.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !isModerator(locals.user)) {
		return { pendingPosts: [] };
	}

	const pendingPosts = await db
		.select({
			id: posts.id,
			threadId: posts.threadId,
			forumId: threads.forumId,
			authorDid: posts.authorDid,
			bodyMarkdown: posts.bodyMarkdown,
			bodyHtml: posts.bodyHtml,
			createdAt: posts.createdAt,
			threadTitle: threads.title,
			threadSlug: threads.slug,
			forumName: forums.name,
			forumSlug: forums.slug,
			authorHandle: users.handle,
			authorDisplayName: users.displayName,
		})
		.from(posts)
		.innerJoin(threads, eq(posts.threadId, threads.id))
		.innerJoin(forums, eq(threads.forumId, forums.id))
		.innerJoin(users, eq(posts.authorDid, users.did))
		.where(and(eq(posts.isApproved, false), eq(posts.status, 'active')))
		.orderBy(posts.createdAt);

	return { pendingPosts };
};

export const actions: Actions = {
	approve: async ({ locals, request }) => {
		if (!locals.user || !isModerator(locals.user)) return fail(403, { error: 'Admin access required' });
		const form = await request.formData();
		const postId = String(form.get('postId') ?? '').trim();
		if (!postId) return fail(422, { error: 'Post ID required' });

		try {
			const [post] = await db
				.select({ threadId: posts.threadId })
				.from(posts)
				.where(eq(posts.id, postId))
				.limit(1);

			if (!post) return fail(404, { error: 'Post not found' });

			await db.transaction(async (tx) => {
				await tx.update(posts).set({ isApproved: true }).where(eq(posts.id, postId));
				await tx.update(threads).set({ lastPostAt: new Date() }).where(eq(threads.id, post.threadId));
			});

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'approve_post',
				targetPostId: postId,
			});

			return { success: true, action: 'approve' };
		} catch (err) {
			console.error('approve action error:', err);
			return fail(500, { error: 'Failed to approve post' });
		}
	},

	reject: async ({ locals, request }) => {
		if (!locals.user || !isModerator(locals.user)) return fail(403, { error: 'Admin access required' });
		const form = await request.formData();
		const postId = String(form.get('postId') ?? '').trim();
		const reason = String(form.get('reason') ?? '').trim();
		if (!postId) return fail(422, { error: 'Post ID required' });
		if (!reason) return fail(422, { error: 'Rejection reason required' });

		try {
			const [post] = await db
				.select({ authorDid: posts.authorDid })
				.from(posts)
				.where(eq(posts.id, postId))
				.limit(1);

			if (!post) return fail(404, { error: 'Post not found' });

			await db
				.update(posts)
				.set({ status: 'hidden', rejectionReason: reason })
				.where(eq(posts.id, postId));

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'reject_post',
				targetPostId: postId,
				reason,
			});

			// Notify the author via in-app inbox
			try {
				await writeInboxNotification(post.authorDid, 'post_rejected', { postId, reason });
			} catch {
				// Notification failure should not block the rejection
			}

			return { success: true, action: 'reject' };
		} catch (err) {
			console.error('reject action error:', err);
			return fail(500, { error: 'Failed to reject post' });
		}
	},
};
