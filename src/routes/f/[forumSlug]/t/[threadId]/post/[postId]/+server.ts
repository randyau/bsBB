import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { posts, postRevisions, users, threads, forums } from '$lib/db/schema';
import { eq, and, max } from 'drizzle-orm';
import { renderMarkdown } from '$lib/markdown/index.js';
import { fetchLinkMetadata } from '$lib/markdown/og.js';

/**
 * PATCH /f/[forumSlug]/t/[threadId]/post/[postId]
 *
 * Edit a post (markdown + link metadata).
 * Only the post author or an admin can edit.
 */
export const PATCH: RequestHandler = async ({ locals, params, request, getClientAddress }) => {
	if (!locals.user) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		// Load post
		const post = await db.query.posts.findFirst({
			where: eq(posts.id, params.postId),
			columns: {
				id: true,
				threadId: true,
				authorDid: true,
				bodyMarkdown: true,
				bodyHtml: true,
				linkMetadata: true,
				createdAt: true
			}
		});

		if (!post) {
			return json({ error: 'Post not found' }, { status: 404 });
		}

		// Only author or admin can edit
		if (post.authorDid !== locals.user.did && locals.user.globalRole !== 'admin') {
			return json({ error: 'You cannot edit this post' }, { status: 403 });
		}

		// Load new body from request
		const body = await request.json();
		const newBodyMarkdown = String(body.body ?? '').trim();

		if (!newBodyMarkdown || newBodyMarkdown.length < 1 || newBodyMarkdown.length > 50000) {
			return json({ error: 'Body must be 1-50,000 characters' }, { status: 422 });
		}

		// If content hasn't changed, return early
		if (newBodyMarkdown === post.bodyMarkdown) {
			return json({ success: true, message: 'No changes made', post });
		}

		// Render markdown and fetch link metadata
		const newBodyHtml = await renderMarkdown(newBodyMarkdown);
		const newLinkMetadata = await fetchLinkMetadata(newBodyMarkdown, getClientAddress());

		// Transaction: create revision, update post
		await db.transaction(async (tx) => {
			// Get next revision number for this post
			const [lastRev] = await tx
				.select({ maxRev: max(postRevisions.revisionNumber) })
				.from(postRevisions)
				.where(eq(postRevisions.postId, post.id));
			const nextRevisionNumber = (lastRev?.maxRev ?? 0) + 1;

			// Create revision entry (snapshot of old content)
			await tx.insert(postRevisions).values({
				postId: post.id,
				revisionNumber: nextRevisionNumber,
				bodyMarkdown: post.bodyMarkdown,
				bodyHtml: post.bodyHtml,
				editedByDid: locals.user!.did,
				createdAt: new Date()
			});

			// Update post with new content
			await tx
				.update(posts)
				.set({
					bodyMarkdown: newBodyMarkdown,
					bodyHtml: newBodyHtml,
					linkMetadata: newLinkMetadata,
					editedAt: new Date()
				})
				.where(eq(posts.id, post.id));
		});

		return json({
			success: true,
			message: 'Post updated',
			post: {
				id: post.id,
				bodyMarkdown: newBodyMarkdown,
				bodyHtml: newBodyHtml,
				editedAt: new Date().toISOString()
			}
		});
	} catch (err) {
		console.error('[patch post error]', err);
		return json({ error: 'Failed to update post' }, { status: 500 });
	}
};
