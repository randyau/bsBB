import type { PageServerLoad } from './$types';
import { db } from '$lib/db';
import { forums, threads, posts, users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { error, redirect } from '@sveltejs/kit';
import { canRead } from '$lib/permissions';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	// Find forum by slug first
	const forum = await db.query.forums.findFirst({
		where: eq(forums.slug, params.forumSlug),
	});

	if (!forum) {
		throw error(404, 'Forum not found');
	}

	// Check permission
	const canAccess = await canRead(db, forum.id, locals.user);
	if (!canAccess) {
		throw error(403, 'Access denied');
	}

	// Find thread by ID
	const thread = await db.query.threads.findFirst({
		where: eq(threads.id, params.threadId),
	});

	if (!thread) {
		throw error(404, 'Thread not found');
	}

	// Validate that thread belongs to this forum
	if (thread.forumId !== forum.id) {
		const correctForum = await db.query.forums.findFirst({
			where: eq(forums.id, thread.forumId),
		});

		if (correctForum) {
			throw redirect(301, `/f/${correctForum.slug}/t/${thread.id}`);
		}

		throw error(404, 'Thread not found');
	}

	// Load all posts for this thread
	const postList = await db
		.select({
			id: posts.id,
			threadId: posts.threadId,
			authorDid: posts.authorDid,
			bodyMarkdown: posts.bodyMarkdown,
			bodyHtml: posts.bodyHtml,
			replyToPostId: posts.replyToPostId,
			isDeleted: posts.isDeleted,
			createdAt: posts.createdAt,
			editedAt: posts.editedAt,
			authorHandle: users.handle,
			authorDisplayName: users.displayName,
			authorAvatarUrl: users.avatarUrl,
		})
		.from(posts)
		.innerJoin(users, eq(posts.authorDid, users.did))
		.where(eq(posts.threadId, thread.id))
		.orderBy(posts.createdAt);

	// For posts with reply_to_post_id, fetch the referenced post for quote preview
	const postMap = new Map(postList.map((p) => [p.id, p]));

	const enrichedPosts = postList.map((post) => {
		let quotedPost = null;

		if (post.replyToPostId && postMap.has(post.replyToPostId)) {
			const quoted = postMap.get(post.replyToPostId)!;
			if (!quoted.isDeleted) {
				quotedPost = {
					id: quoted.id,
					authorHandle: quoted.authorHandle,
					bodyPreview: quoted.bodyHtml?.substring(0, 100) ?? '...',
				};
			}
		}

		return { ...post, quotedPost };
	});

	// Get thread author info
	const threadAuthor = await db.query.users.findFirst({
		where: eq(users.did, thread.authorDid),
	});

	return {
		forum,
		thread,
		threadAuthor,
		posts: enrichedPosts,
	};
};
