import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { posts, threads, users, modLog, forums } from '$lib/db/schema';
import { eq, desc, ilike, and, or, inArray, count } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q') ?? '';
	const pageParam = url.searchParams.get('page');
	const page = pageParam ? Math.max(1, parseInt(pageParam)) : 1;
	const offset = (page - 1) * PAGE_SIZE;

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

	// Get total count
	const [{ count: totalPosts }] = await db
		.select({ count: count() })
		.from(posts)
		.innerJoin(threads, eq(posts.threadId, threads.id))
		.innerJoin(forums, eq(threads.forumId, forums.id))
		.innerJoin(users, eq(posts.authorDid, users.did))
		.where(where);

	const postList = await db
		.select({
			id: posts.id,
			threadId: threads.id,
			threadTitle: threads.title,
			threadSlug: threads.slug,
			forumSlug: forums.slug,
			forumId: forums.id,
			authorHandle: users.handle,
			authorDid: users.did,
			bodyMarkdown: posts.bodyMarkdown,
			status: posts.status,
			createdAt: posts.createdAt
		})
		.from(posts)
		.innerJoin(threads, eq(posts.threadId, threads.id))
		.innerJoin(forums, eq(threads.forumId, forums.id))
		.innerJoin(users, eq(posts.authorDid, users.did))
		.where(where)
		.orderBy(desc(posts.createdAt))
		.limit(PAGE_SIZE)
		.offset(offset);

	// Get list of all threads for move destination
	const threadList = await db
		.select({ id: threads.id, title: threads.title, slug: threads.slug, forumId: forums.id, forumSlug: forums.slug })
		.from(threads)
		.innerJoin(forums, eq(threads.forumId, forums.id))
		.orderBy(threads.title);

	const totalPages = Math.ceil(totalPosts / PAGE_SIZE);

	return {
		posts: postList,
		threads: threadList,
		q,
		page,
		pageSize: PAGE_SIZE,
		total: totalPosts,
		totalPages
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
	},

	movePost: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
		const form = await request.formData();
		const postId = String(form.get('postId') ?? '').trim();
		const destThreadId = String(form.get('destThreadId') ?? '').trim();

		if (!postId || !destThreadId) return fail(422, { error: 'Post ID and destination thread are required' });

		try {
			// Verify destination thread exists
			const [destThread] = await db
				.select({ id: threads.id, title: threads.title })
				.from(threads)
				.where(eq(threads.id, destThreadId))
				.limit(1);

			if (!destThread) {
				return fail(422, { error: 'Destination thread not found' });
			}

			// Get current thread info for reason field
			const [post] = await db
				.select({ threadId: posts.threadId })
				.from(posts)
				.where(eq(posts.id, postId))
				.limit(1);

			if (!post) {
				return fail(422, { error: 'Post not found' });
			}

			const [currentThread] = await db
				.select({ title: threads.title })
				.from(threads)
				.where(eq(threads.id, post.threadId))
				.limit(1);

			// Move post to new thread
			await db
				.update(posts)
				.set({ threadId: destThreadId })
				.where(eq(posts.id, postId));

			// Log the action with source and destination info
			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'move_post',
				targetPostId: postId,
				reason: `from: "${currentThread?.title || 'unknown'}", to: "${destThread.title}"`
			});

			return { success: true, action: 'movePost', postId };
		} catch (err) {
			console.error('movePost error:', err);
			return fail(500, { error: 'Failed to move post' });
		}
	},

	// Bulk action: hide, restore, or delete multiple posts at once
	bulkAction: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
		const form = await request.formData();
		const action = String(form.get('action') ?? '').trim();
		const postIdString = String(form.get('postIds') ?? '').trim();

		if (!action || !postIdString) return fail(422, { error: 'Action and post IDs required' });

		const postIds = postIdString.split(',').filter(id => id.trim());
		if (postIds.length === 0) return fail(422, { error: 'No posts selected' });

		try {
			// Validate all posts exist
			const validPosts = await db
				.select({ id: posts.id })
				.from(posts)
				.where(inArray(posts.id, postIds));

			if (validPosts.length === 0) return fail(422, { error: 'No valid posts found' });

			if (action === 'hide') {
				await db.update(posts).set({ status: 'hidden' }).where(inArray(posts.id, postIds));

				for (const postId of validPosts.map(p => p.id)) {
					await db.insert(modLog).values({
						moderatorDid: locals.user!.did,
						action: 'hide_post',
						targetPostId: postId
					});
				}
			} else if (action === 'restore') {
				await db.update(posts).set({ status: 'active' }).where(inArray(posts.id, postIds));

				for (const postId of validPosts.map(p => p.id)) {
					await db.insert(modLog).values({
						moderatorDid: locals.user!.did,
						action: 'restore_post',
						targetPostId: postId
					});
				}
			}

			return { success: true, action: `bulk_${action}`, count: validPosts.length };
		} catch (err) {
			console.error('bulkAction error:', err);
			return fail(500, { error: 'Failed to perform bulk action' });
		}
	}
};
