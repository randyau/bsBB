import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { forums, threads, posts, users } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { error, redirect, fail } from '@sveltejs/kit';
import { canRead, canPost } from '$lib/permissions/index.js';
import { renderMarkdown } from '$lib/markdown/index.js';
import { fetchLinkMetadata } from '$lib/markdown/og.js';
import { checkAbuse } from '$lib/abuse/index.js';

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

	// Find thread by slug (unique per forum)
	const thread = await db.query.threads.findFirst({
		where: and(eq(threads.forumId, forum.id), eq(threads.slug, params.threadId)),
	});

	if (!thread) {
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

	// Check if user can post
	const userCanPost = await canPost(db, forum.id, locals.user);

	return {
		forum,
		thread,
		threadAuthor,
		posts: enrichedPosts,
		canPost: userCanPost,
	};
};

export const actions: Actions = {
	reply: async ({ locals, params, request, getClientAddress }) => {
		if (!locals.user) {
			return redirect(303, '/login');
		}

		// Load forum and thread to validate
		const forum = await db.query.forums.findFirst({
			where: eq(forums.slug, params.forumSlug),
		});

		if (!forum) {
			throw error(404, 'Forum not found');
		}

		const thread = await db.query.threads.findFirst({
			where: and(eq(threads.forumId, forum.id), eq(threads.slug, params.threadId)),
		});

		if (!thread) {
			throw error(404, 'Thread not found');
		}

		if (thread.isLocked) {
			return fail(403, { error: 'This thread is locked' });
		}

		const canPostHere = await canPost(db, forum.id, locals.user);
		if (!canPostHere) {
			return fail(403, { error: 'You do not have permission to post in this forum' });
		}

		const ip = getClientAddress();
		try {
			await checkAbuse({ type: 'post_submit', did: locals.user.did, ip });
		} catch {
			return fail(429, { error: 'Too many requests. Please try again later.' });
		}

		const form = await request.formData();
		const body = String(form.get('body') ?? '').trim();
		const replyToPostId = String(form.get('replyToPostId') ?? '').trim() || null;

		if (!body || body.length < 1 || body.length > 50000) {
			return fail(422, { error: 'Body must be 1-50,000 characters' });
		}

		// Validate replyToPostId if provided
		if (replyToPostId) {
			const replyToPost = await db.query.posts.findFirst({
				where: eq(posts.id, replyToPostId),
			});

			if (!replyToPost || replyToPost.threadId !== thread.id) {
				return fail(422, { error: 'Invalid reply target' });
			}
		}

		try {
			const bodyHtml = await renderMarkdown(body);
			const linkMetadata = await fetchLinkMetadata(body);

			await db.transaction(async (tx) => {
				await tx.insert(posts).values({
					threadId: thread.id,
					authorDid: locals.user!.did,
					bodyMarkdown: body,
					bodyHtml,
					replyToPostId,
					linkMetadata,
				});

				await tx.update(threads).set({ lastPostAt: new Date() }).where(eq(threads.id, thread.id));
			});
		} catch (err) {
			console.error('[reply error]', err);
			return fail(500, { error: 'Failed to post reply' });
		}

		throw redirect(303, `/f/${forum.slug}/t/${thread.slug}`);
	},
};
