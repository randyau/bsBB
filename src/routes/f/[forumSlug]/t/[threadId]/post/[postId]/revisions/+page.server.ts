import type { PageServerLoad } from './$types';
import { db } from '$lib/db';
import { posts, postRevisions, users, threads, forums } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getSetting } from '$lib/settings.js';
import { isModerator } from '$lib/auth/roles.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	const visibility = await getSetting('revision_history_visibility', 'public');
	if (visibility === 'moderator' && !isModerator(locals.user)) {
		throw error(403, 'Edit history is only visible to moderators');
	}

	// Load forum
	const forum = await db.query.forums.findFirst({
		where: eq(forums.slug, params.forumSlug)
	});

	if (!forum) {
		throw error(404, 'Forum not found');
	}

	// Load thread
	const thread = await db.query.threads.findFirst({
		where: and(eq(threads.forumId, forum.id), eq(threads.slug, params.threadId))
	});

	if (!thread) {
		throw error(404, 'Thread not found');
	}

	// Load post
	const post = await db.query.posts.findFirst({
		where: eq(posts.id, params.postId),
		columns: {
			id: true,
			threadId: true,
			authorDid: true,
			bodyMarkdown: true,
			bodyHtml: true,
			createdAt: true,
			editedAt: true
		}
	});

	if (!post || post.threadId !== thread.id) {
		throw error(404, 'Post not found');
	}

	// Load all revisions for this post
	const revisions = await db
		.select({
			id: postRevisions.id,
			revisionNumber: postRevisions.revisionNumber,
			bodyMarkdown: postRevisions.bodyMarkdown,
			bodyHtml: postRevisions.bodyHtml,
			editedByDid: postRevisions.editedByDid,
			editorHandle: users.handle,
			editorDisplayName: users.displayName,
			createdAt: postRevisions.createdAt
		})
		.from(postRevisions)
		.innerJoin(users, eq(postRevisions.editedByDid, users.did))
		.where(eq(postRevisions.postId, params.postId))
		.orderBy(postRevisions.createdAt);

	// Load current post author
	const author = await db.query.users.findFirst({
		where: eq(users.did, post.authorDid),
		columns: { handle: true, displayName: true }
	});

	return {
		forum,
		thread,
		post: {
			...post,
			authorHandle: author?.handle || post.authorDid,
			authorDisplayName: author?.displayName
		},
		revisions
	};
};
