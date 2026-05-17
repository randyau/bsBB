import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { posts, threads, users, modLog } from '$lib/db/schema';
import { eq, desc, ilike, and, or } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q') ?? '';

	const conditions = [];
	if (q.trim()) {
		conditions.push(
			or(
				ilike(users.handle, `%${q}%`),
				ilike(threads.title, `%${q}%`)
			)
		);
	}
	const where = conditions.length > 0 ? and(...conditions) : undefined;

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
			status: posts.status,
			createdAt: posts.createdAt
		})
		.from(posts)
		.innerJoin(threads, eq(posts.threadId, threads.id))
		.innerJoin(users, eq(posts.authorDid, users.did))
		.where(where)
		.orderBy(desc(posts.createdAt))
		.limit(200);

	return {
		posts: postList,
		q
	};
};

export const actions: Actions = {
	// Hide post (soft-delete, content preserved, can be restored)
	hide: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
		const form = await request.formData();
		const postId = String(form.get('postId') ?? '').trim();
		const reason = String(form.get('reason') ?? '').trim();

		if (!postId) return fail(422, { error: 'Post ID is required' });

		try {
			await db.update(posts).set({ status: 'hidden' }).where(eq(posts.id, postId));

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'hide_post',
				targetPostId: postId,
				reason: reason || undefined
			});

			return { success: true, action: 'hide', postId };
		} catch (err) {
			return fail(500, { error: 'Failed to hide post' });
		}
	},

	// Restore hidden post
	restore: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
		const form = await request.formData();
		const postId = String(form.get('postId') ?? '').trim();
		const reason = String(form.get('reason') ?? '').trim();

		if (!postId) return fail(422, { error: 'Post ID is required' });

		try {
			await db.update(posts).set({ status: 'active' }).where(eq(posts.id, postId));

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'restore_post',
				targetPostId: postId,
				reason: reason || undefined
			});

			return { success: true, action: 'restore', postId };
		} catch (err) {
			return fail(500, { error: 'Failed to restore post' });
		}
	},

	// Permanently delete post (clear content, set status to deleted)
	// Post stub remains for quotes/links but content is irretrievable
	permanentlyDelete: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
		const form = await request.formData();
		const postId = String(form.get('postId') ?? '').trim();
		const reason = String(form.get('reason') ?? '').trim();

		if (!postId) return fail(422, { error: 'Post ID is required' });

		try {
			// Clear content and mark as deleted
			await db.update(posts).set({
				status: 'deleted',
				bodyMarkdown: '',
				bodyHtml: '',
				linkMetadata: null,
				replyToPostId: null
			}).where(eq(posts.id, postId));

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'permanently_delete_post',
				targetPostId: postId,
				reason: reason || undefined
			});

			return { success: true, action: 'permanently_delete', postId };
		} catch (err) {
			return fail(500, { error: 'Failed to permanently delete post' });
		}
	},

	// Legacy delete endpoint - maps to hide for backwards compatibility
	delete: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
		const form = await request.formData();
		const postId = String(form.get('postId') ?? '').trim();
		const reason = String(form.get('reason') ?? '').trim();

		if (!postId) return fail(422, { error: 'Post ID is required' });

		try {
			await db.update(posts).set({ status: 'hidden' }).where(eq(posts.id, postId));

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'hide_post',
				targetPostId: postId,
				reason: reason || undefined
			});

			return { success: true, action: 'delete', postId };
		} catch (err) {
			return fail(500, { error: 'Failed to hide post' });
		}
	}
};
