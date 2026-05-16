import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { forums, threads, posts, users, userForumRoles, modLog } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { error, redirect, fail } from '@sveltejs/kit';
import { canRead, canPost } from '$lib/permissions/index.js';
import { renderMarkdown } from '$lib/markdown/index.js';
import { fetchLinkMetadata } from '$lib/markdown/og.js';
import { checkAbuse } from '$lib/abuse/index.js';
import { enqueueProfileSync } from '$lib/notifications.js';

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

	// Check if user can moderate (admin or forum-level moderator)
	let canModerate = false;
	if (locals.user) {
		if (locals.user.globalRole === 'admin') {
			canModerate = true;
		} else {
			const [forumRole] = await db
				.select()
				.from(userForumRoles)
				.where(and(eq(userForumRoles.userDid, locals.user.did), eq(userForumRoles.forumId, forum.id)))
				.limit(1);
			canModerate = forumRole?.role === 'moderator';
		}
	}

	return {
		forum,
		thread,
		threadAuthor,
		posts: enrichedPosts,
		canPost: userCanPost,
		canModerate,
		user: locals.user ?? null,
	};
};

async function loadForMod(locals: App.Locals, params: { forumSlug: string; threadId: string }) {
	if (!locals.user) throw error(403, 'Not authenticated');

	const [forum] = await db.select().from(forums).where(eq(forums.slug, params.forumSlug)).limit(1);
	if (!forum) throw error(404, 'Forum not found');

	const [thread] = await db
		.select()
		.from(threads)
		.where(and(eq(threads.forumId, forum.id), eq(threads.slug, params.threadId)))
		.limit(1);
	if (!thread) throw error(404, 'Thread not found');

	const isAdmin = locals.user.globalRole === 'admin';
	if (!isAdmin) {
		const [forumRole] = await db
			.select()
			.from(userForumRoles)
			.where(and(eq(userForumRoles.userDid, locals.user.did), eq(userForumRoles.forumId, forum.id)))
			.limit(1);
		if (forumRole?.role !== 'moderator') throw error(403, 'Moderator access required');
	}

	return { user: locals.user, forum, thread };
}

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
		const verdict = await checkAbuse({ type: 'post_submit', did: locals.user.did, ip });
		if (!verdict.allowed) {
			return fail(429, { error: 'Too many requests. Please try again later.' });
		}

		// Lazy profile sync: enqueue sync task if profile is >24h stale
		const user = await db.query.users.findFirst({
			where: eq(users.did, locals.user.did),
			columns: { lastProfileSync: true },
		});

		if (user?.lastProfileSync) {
			const hoursSinceSync = (Date.now() - user.lastProfileSync.getTime()) / (1000 * 60 * 60);
			if (hoursSinceSync > 24) {
				await enqueueProfileSync(locals.user.did);
			}
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

	lockThread: async ({ locals, params }) => {
		const { user, thread: t, forum: f } = await loadForMod(locals, params);
		await db.update(threads).set({ isLocked: true }).where(eq(threads.id, t.id));
		await db.insert(modLog).values({ moderatorDid: user.did, action: 'lock_thread', targetThreadId: t.id });
		throw redirect(303, `/f/${f.slug}/t/${t.slug}`);
	},

	unlockThread: async ({ locals, params }) => {
		const { user, thread: t, forum: f } = await loadForMod(locals, params);
		await db.update(threads).set({ isLocked: false }).where(eq(threads.id, t.id));
		await db.insert(modLog).values({ moderatorDid: user.did, action: 'unlock_thread', targetThreadId: t.id });
		throw redirect(303, `/f/${f.slug}/t/${t.slug}`);
	},

	pinThread: async ({ locals, params }) => {
		const { user, thread: t, forum: f } = await loadForMod(locals, params);
		if (locals.user?.globalRole !== 'admin') return fail(403, { error: 'Only admins can pin threads' });
		await db.update(threads).set({ isPinned: true }).where(eq(threads.id, t.id));
		await db.insert(modLog).values({ moderatorDid: user.did, action: 'pin_thread', targetThreadId: t.id });
		throw redirect(303, `/f/${f.slug}/t/${t.slug}`);
	},

	unpinThread: async ({ locals, params }) => {
		const { user, thread: t, forum: f } = await loadForMod(locals, params);
		if (locals.user?.globalRole !== 'admin') return fail(403, { error: 'Only admins can unpin threads' });
		await db.update(threads).set({ isPinned: false }).where(eq(threads.id, t.id));
		await db.insert(modLog).values({ moderatorDid: user.did, action: 'unpin_thread', targetThreadId: t.id });
		throw redirect(303, `/f/${f.slug}/t/${t.slug}`);
	},

	deletePost: async ({ locals, params, request }) => {
		const { user, forum: f, thread: t } = await loadForMod(locals, params);
		const form = await request.formData();
		const postId = String(form.get('postId') ?? '').trim();
		const reason = String(form.get('reason') ?? '').trim();
		if (!postId) return fail(422, { error: 'Post ID required' });
		await db.update(posts).set({ isDeleted: true }).where(eq(posts.id, postId));
		await db.insert(modLog).values({ moderatorDid: user.did, action: 'delete_post', targetPostId: postId, reason: reason || undefined });
		throw redirect(303, `/f/${f.slug}/t/${t.slug}`);
	},

	restorePost: async ({ locals, params, request }) => {
		const { user, forum: f, thread: t } = await loadForMod(locals, params);
		const form = await request.formData();
		const postId = String(form.get('postId') ?? '').trim();
		if (!postId) return fail(422, { error: 'Post ID required' });
		await db.update(posts).set({ isDeleted: false }).where(eq(posts.id, postId));
		await db.insert(modLog).values({ moderatorDid: user.did, action: 'restore_post', targetPostId: postId });
		throw redirect(303, `/f/${f.slug}/t/${t.slug}`);
	},
};
