import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { posts, threads, users, modLog } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
	const postList = await db
		.select({
			id: posts.id,
			threadId: threads.id,
			threadTitle: threads.title,
			threadSlug: threads.slug,
			forumSlug: threads.forumId,
			authorHandle: users.handle,
			authorDid: users.did,
			bodyMarkdown: posts.bodyMarkdown,
			isDeleted: posts.isDeleted,
			createdAt: posts.createdAt
		})
		.from(posts)
		.innerJoin(threads, eq(posts.threadId, threads.id))
		.innerJoin(users, eq(posts.authorDid, users.did))
		.orderBy(desc(posts.createdAt))
		.limit(200);

	return {
		posts: postList
	};
};

export const actions: Actions = {
	delete: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
		const form = await request.formData();
		const postId = String(form.get('postId') ?? '').trim();
		const reason = String(form.get('reason') ?? '').trim();

		if (!postId) return fail(422, { error: 'Post ID is required' });

		try {
			await db.update(posts).set({ isDeleted: true }).where(eq(posts.id, postId));

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'delete_post',
				targetPostId: postId,
				reason: reason || undefined
			});

			return { success: true, action: 'delete', postId };
		} catch (err) {
			return fail(500, { error: 'Failed to delete post' });
		}
	},

	restore: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
		const form = await request.formData();
		const postId = String(form.get('postId') ?? '').trim();

		if (!postId) return fail(422, { error: 'Post ID is required' });

		try {
			await db.update(posts).set({ isDeleted: false }).where(eq(posts.id, postId));

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'restore_post',
				targetPostId: postId
			});

			return { success: true, action: 'restore', postId };
		} catch (err) {
			return fail(500, { error: 'Failed to restore post' });
		}
	}
};
