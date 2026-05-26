import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { users, posts, threads, forums, modLog } from '$lib/db/schema';
import { isModerator } from '$lib/auth/roles.js';
import { eq, and, like, desc, or } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import { logger as rootLogger } from '$lib/logger';

const log = rootLogger.child({ module: 'routes:user:manage-posts' });

const POSTS_PER_PAGE = 25;

export const load: PageServerLoad = async ({ locals, params, url }) => {
	// Find user by handle
	const profileUser = await db.query.users.findFirst({
		where: eq(users.handle, params.handle)
	});

	if (!profileUser) {
		throw error(404, 'User not found');
	}

	// Check permission: only user or admin can manage posts
	const isOwner = locals.user?.did === profileUser.did;
	const isAdmin = isModerator(locals.user);

	if (!isOwner && !isAdmin) {
		throw error(403, 'You do not have permission to manage this user\'s posts');
	}

	// Get pagination and search params
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
	const search = url.searchParams.get('search')?.trim() ?? '';
	const offset = (page - 1) * POSTS_PER_PAGE;

	// Build query with optional search
	const whereCondition = search
		? and(eq(posts.authorDid, profileUser.did), like(posts.bodyMarkdown, `%${search}%`))
		: eq(posts.authorDid, profileUser.did);

	const query = db
		.select({
			id: posts.id,
			bodyMarkdown: posts.bodyMarkdown,
			status: posts.status,
			createdAt: posts.createdAt,
			editedAt: posts.editedAt,
			threadId: threads.id,
			threadTitle: threads.title,
			threadSlug: threads.slug,
			forumName: forums.name,
			forumSlug: forums.slug
		})
		.from(posts)
		.innerJoin(threads, eq(posts.threadId, threads.id))
		.innerJoin(forums, eq(threads.forumId, forums.id))
		.where(whereCondition);

	// Get total count for pagination
	const countResult = await db
		.select({ count: posts.id })
		.from(posts)
		.where(
			search
				? and(eq(posts.authorDid, profileUser.did), like(posts.bodyMarkdown, `%${search}%`))
				: eq(posts.authorDid, profileUser.did)
		);

	const totalPosts = countResult.length;
	const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);

	// Fetch paginated posts
	const userPosts = await query
		.orderBy(desc(posts.createdAt))
		.limit(POSTS_PER_PAGE)
		.offset(offset);

	return {
		profileUser,
		isOwner,
		isAdmin,
		userPosts: userPosts.map((p) => ({
			...p,
			bodyPreview: p.bodyMarkdown.substring(0, 150)
		})),
		currentPage: page,
		totalPages,
		totalPosts,
		search,
		postsPerPage: POSTS_PER_PAGE
	};
};

export const actions: Actions = {
	hidePost: async ({ locals, request, params }) => {
		if (!locals.user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const form = await request.formData();
		const postId = String(form.get('postId') ?? '').trim();

		if (!postId) {
			return fail(422, { error: 'Post ID required' });
		}

		try {
			// Get the post
			const post = await db.query.posts.findFirst({
				where: eq(posts.id, postId),
				columns: { authorDid: true, threadId: true }
			});

			if (!post) {
				return fail(404, { error: 'Post not found' });
			}

			// Check permission
			const isOwner = locals.user.did === post.authorDid;
			const isAdmin = locals.user.globalRole === 'admin';

			if (!isOwner && !isAdmin) {
				return fail(403, { error: 'Permission denied' });
			}

			// Hide the post
			await db.update(posts).set({ status: 'hidden' }).where(eq(posts.id, postId));

			// Log the action
			await db.insert(modLog).values({
				moderatorDid: locals.user.did,
				action: isOwner ? 'hide_own_post' : 'hide_post',
				targetPostId: postId
			});

			return { success: true, action: 'hidePost' };
		} catch (err) {
			log.error({ err }, 'hidePost error:');
			return fail(500, { error: 'Failed to hide post' });
		}
	},

	deletePost: async ({ locals, request, params }) => {
		if (!locals.user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const form = await request.formData();
		const postId = String(form.get('postId') ?? '').trim();

		if (!postId) {
			return fail(422, { error: 'Post ID required' });
		}

		try {
			// Get the post
			const post = await db.query.posts.findFirst({
				where: eq(posts.id, postId),
				columns: { authorDid: true }
			});

			if (!post) {
				return fail(404, { error: 'Post not found' });
			}

			// Check permission
			const isOwner = locals.user.did === post.authorDid;
			const isAdmin = locals.user.globalRole === 'admin';

			if (!isOwner && !isAdmin) {
				return fail(403, { error: 'Permission denied' });
			}

			// Mark as deleted
			await db.update(posts).set({ status: 'deleted' }).where(eq(posts.id, postId));

			// Log the action
			await db.insert(modLog).values({
				moderatorDid: locals.user.did,
				action: isOwner ? 'delete_own_post' : 'delete_post',
				targetPostId: postId
			});

			return { success: true, action: 'deletePost' };
		} catch (err) {
			log.error({ err }, 'deletePost error:');
			return fail(500, { error: 'Failed to delete post' });
		}
	},

	restorePost: async ({ locals, request, params }) => {
		if (!locals.user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const form = await request.formData();
		const postId = String(form.get('postId') ?? '').trim();

		if (!postId) {
			return fail(422, { error: 'Post ID required' });
		}

		try {
			// Get the post
			const post = await db.query.posts.findFirst({
				where: eq(posts.id, postId),
				columns: { authorDid: true }
			});

			if (!post) {
				return fail(404, { error: 'Post not found' });
			}

			// Check permission
			const isOwner = locals.user.did === post.authorDid;
			const isAdmin = locals.user.globalRole === 'admin';

			if (!isOwner && !isAdmin) {
				return fail(403, { error: 'Permission denied' });
			}

			// Restore the post
			await db.update(posts).set({ status: 'active' }).where(eq(posts.id, postId));

			// Log the action
			await db.insert(modLog).values({
				moderatorDid: locals.user.did,
				action: 'restore_post',
				targetPostId: postId
			});

			return { success: true, action: 'restorePost' };
		} catch (err) {
			log.error({ err }, 'restorePost error:');
			return fail(500, { error: 'Failed to restore post' });
		}
	}
};
