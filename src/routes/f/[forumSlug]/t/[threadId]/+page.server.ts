import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { forums, threads, posts, users, userForumRoles, modLog, threadViews, notificationSubscriptions, piiRemovalRequests } from '$lib/db/schema';
import { eq, and, sql, ne, inArray, count } from 'drizzle-orm';
import { error, redirect, fail } from '@sveltejs/kit';
import { canRead, canPost } from '$lib/permissions/index.js';
import { isModerator } from '$lib/auth/roles.js';
import { renderMarkdown } from '$lib/markdown/index.js';
import { fetchLinkMetadata } from '$lib/markdown/og.js';
import { checkAbuse } from '$lib/abuse/index.js';
import { enqueueProfileSync, enqueueDmNotification } from '$lib/notifications.js';
import { getSetting } from '$lib/settings.js';

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

	const PAGE_SIZE = 100;
	const currentPage = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);

	// Count total posts for pagination (includes unapproved so mods see correct count)
	const [{ total: totalPosts }] = await db
		.select({ total: count() })
		.from(posts)
		.where(eq(posts.threadId, thread.id));

	const totalPages = Math.max(1, Math.ceil(totalPosts / PAGE_SIZE));
	const safePage = Math.min(currentPage, totalPages);

	// Load one page of posts for this thread
	const postList = await db
		.select({
			id: posts.id,
			threadId: posts.threadId,
			authorDid: posts.authorDid,
			bodyMarkdown: posts.bodyMarkdown,
			bodyHtml: posts.bodyHtml,
			linkMetadata: posts.linkMetadata,
			replyToPostId: posts.replyToPostId,
			status: posts.status,
			isApproved: posts.isApproved,
			createdAt: posts.createdAt,
			editedAt: posts.editedAt,
			authorHandle: users.handle,
			authorDisplayName: users.displayName,
			authorAvatarUrl: users.avatarUrl,
		})
		.from(posts)
		.innerJoin(users, eq(posts.authorDid, users.did))
		.where(eq(posts.threadId, thread.id))
		.orderBy(posts.createdAt)
		.limit(PAGE_SIZE)
		.offset((safePage - 1) * PAGE_SIZE);

	// Check if user can moderate (needed before post filtering)
	let canModerate = false;
	if (locals.user) {
		if (isModerator(locals.user)) {
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

	// For posts with reply_to_post_id, fetch the referenced post for quote preview
	const postMap = new Map(postList.map((p) => [p.id, p]));

	// Batch-fetch all self-hidden post IDs in one query (avoids N+1 per hidden post)
	const hiddenPostIds = postList.filter(p => p.status === 'hidden').map(p => p.id);
	const selfHiddenIds = new Set<string>();
	if (hiddenPostIds.length > 0) {
		const selfHideLogs = await db
			.select({ targetPostId: modLog.targetPostId })
			.from(modLog)
			.where(and(eq(modLog.action, 'hide_own_post'), inArray(modLog.targetPostId, hiddenPostIds)));
		for (const row of selfHideLogs) {
			if (row.targetPostId) selfHiddenIds.add(row.targetPostId);
		}
	}

	const enrichedPosts = postList
		.filter((post) => {
			// Hide unapproved posts from everyone except the author and mods
			if (!post.isApproved) {
				if (canModerate) return true;
				if (locals.user && locals.user.did === post.authorDid) return true;
				return false;
			}
			return true;
		})
		.map((post) => {
			let quotedPost = null;

			if (post.replyToPostId && postMap.has(post.replyToPostId)) {
				const quoted = postMap.get(post.replyToPostId)!;
				if (quoted.status === 'active') {
					quotedPost = {
						id: quoted.id,
						authorHandle: quoted.authorHandle,
						bodyPreview: quoted.bodyHtml?.substring(0, 100) ?? '...',
					};
				}
			}

			return { ...post, quotedPost, hiddenByUser: selfHiddenIds.has(post.id) };
		});

	// Get thread author info
	const threadAuthor = await db.query.users.findFirst({
		where: eq(users.did, thread.authorDid),
	});

	// Check if user can post
	const userCanPost = await canPost(db, forum.id, locals.user);

	// Track thread view for logged-in users (upsert avoids TOCTOU race)
	if (locals.user) {
		const now = new Date();
		await db
			.insert(threadViews)
			.values({ userDid: locals.user.did, threadId: thread.id, lastViewedAt: now })
			.onConflictDoUpdate({
				target: [threadViews.userDid, threadViews.threadId],
				set: { lastViewedAt: now },
			});
	}

	// Load thread subscription status for logged-in users
	let userSubscription: 'follow' | 'mute' | null = null;
	if (locals.user) {
		const [sub] = await db
			.select({ subscriptionType: notificationSubscriptions.subscriptionType })
			.from(notificationSubscriptions)
			.where(
				and(
					eq(notificationSubscriptions.userDid, locals.user.did),
					eq(notificationSubscriptions.threadId, thread.id)
				)
			)
			.limit(1);
		userSubscription = (sub?.subscriptionType as 'follow' | 'mute') ?? null;
	}

	const revisionHistoryVisibility = await getSetting('revision_history_visibility', 'public');
	const canViewRevisions = revisionHistoryVisibility === 'public' || canModerate;

	return {
		forum,
		thread,
		threadAuthor,
		posts: enrichedPosts,
		canPost: userCanPost,
		canModerate,
		canViewRevisions,
		user: locals.user ?? null,
		userSubscription,
		page: safePage,
		totalPages,
		totalPosts,
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

	if (!isModerator(locals.user)) {
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

		// Determine if post needs approval
		let requiresApproval = false;
		if (!isModerator(locals.user) && forum.requireApprovalDays > 0) {
			const author = await db.query.users.findFirst({
				where: eq(users.did, locals.user.did),
				columns: { createdAt: true },
			});
			if (author) {
				const accountAgeDays = (Date.now() - author.createdAt.getTime()) / (1000 * 60 * 60 * 24);
				requiresApproval = accountAgeDays < forum.requireApprovalDays;
			}
		}

		try {
			const bodyHtml = await renderMarkdown(body, db);
			const linkMetadata = await fetchLinkMetadata(body, ip);

			await db.transaction(async (tx) => {
				await tx.insert(posts).values({
					threadId: thread.id,
					authorDid: locals.user!.did,
					bodyMarkdown: body,
					bodyHtml,
					replyToPostId,
					linkMetadata,
					isApproved: !requiresApproval,
				});

				// Only update lastPostAt for approved posts (pending posts shouldn't bump the thread)
				if (!requiresApproval) {
					await tx.update(threads).set({ lastPostAt: new Date() }).where(eq(threads.id, thread.id));
				}
			});
		} catch (err) {
			console.error('[reply error]', err);
			return fail(500, { error: 'Failed to post reply' });
		}

		// Fire notifications (best-effort, don't block the response)
		if (!requiresApproval) {
			const actorDid = locals.user.did;
			const notifPayload = {
				threadId: thread.id,
				threadTitle: thread.title,
				threadSlug: thread.slug,
				forumSlug: forum.slug,
				replyAuthorHandle: locals.user.handle,
			};

			// Notify quoted post author
			let quotedAuthorDid: string | undefined;
			if (replyToPostId) {
				const quotedPost = await db.query.posts.findFirst({
					where: eq(posts.id, replyToPostId),
					columns: { authorDid: true },
				});
				quotedAuthorDid = quotedPost?.authorDid;
				if (quotedAuthorDid && quotedAuthorDid !== actorDid) {
					enqueueDmNotification(quotedAuthorDid, 'quote', notifPayload, actorDid).catch(() => {});
				}
			}

			// Notify thread author of a reply (skip if they were already notified as the quoted author)
			if (thread.authorDid !== actorDid && thread.authorDid !== quotedAuthorDid) {
				enqueueDmNotification(thread.authorDid, 'reply', notifPayload, actorDid).catch(() => {});
			}

			// Notify thread followers (excluding the poster and thread author already notified above)
			const followers = await db
				.select({ userDid: notificationSubscriptions.userDid })
				.from(notificationSubscriptions)
				.where(and(
					eq(notificationSubscriptions.threadId, thread.id),
					eq(notificationSubscriptions.subscriptionType, 'follow'),
				));

			for (const { userDid } of followers) {
				if (userDid !== actorDid && userDid !== thread.authorDid) {
					enqueueDmNotification(userDid, 'new_reply_in_thread', notifPayload, actorDid).catch(() => {});
				}
			}
		}

		if (requiresApproval) {
			throw redirect(303, `/f/${forum.slug}/t/${thread.slug}?pending=1`);
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
		await db.update(posts).set({ status: 'hidden' }).where(eq(posts.id, postId));
		await db.insert(modLog).values({ moderatorDid: user.did, action: 'hide_post', targetPostId: postId, reason: reason || undefined });
		throw redirect(303, `/f/${f.slug}/t/${t.slug}`);
	},

	restorePost: async ({ locals, params, request }) => {
		const { user, forum: f, thread: t } = await loadForMod(locals, params);
		const form = await request.formData();
		const postId = String(form.get('postId') ?? '').trim();
		const reason = String(form.get('reason') ?? '').trim();
		if (!postId) return fail(422, { error: 'Post ID required' });
		await db.update(posts).set({ status: 'active' }).where(eq(posts.id, postId));
		await db.insert(modLog).values({ moderatorDid: user.did, action: 'restore_post', targetPostId: postId, reason: reason || undefined });
		throw redirect(303, `/f/${f.slug}/t/${t.slug}`);
	},

	watchThread: async ({ locals, params }) => {
		if (!locals.user) throw error(403, 'Not authenticated');

		// Resolve thread
		const [forum] = await db.select().from(forums).where(eq(forums.slug, params.forumSlug)).limit(1);
		if (!forum) throw error(404, 'Forum not found');

		const [thread] = await db.select().from(threads)
			.where(and(eq(threads.forumId, forum.id), eq(threads.slug, params.threadId)))
			.limit(1);
		if (!thread) throw error(404, 'Thread not found');

		// Check if subscription exists
		const [existing] = await db.select()
			.from(notificationSubscriptions)
			.where(and(
				eq(notificationSubscriptions.userDid, locals.user.did),
				eq(notificationSubscriptions.threadId, thread.id)
			))
			.limit(1);

		if (existing) {
			// Update subscription type to 'follow'
			await db.update(notificationSubscriptions)
				.set({ subscriptionType: 'follow' })
				.where(eq(notificationSubscriptions.id, existing.id));
		} else {
			// Insert new subscription
			await db.insert(notificationSubscriptions).values({
				userDid: locals.user.did,
				threadId: thread.id,
				subscriptionType: 'follow',
			});
		}

		throw redirect(303, `/f/${forum.slug}/t/${thread.slug}`);
	},

	muteThread: async ({ locals, params }) => {
		if (!locals.user) throw error(403, 'Not authenticated');

		// Resolve thread
		const [forum] = await db.select().from(forums).where(eq(forums.slug, params.forumSlug)).limit(1);
		if (!forum) throw error(404, 'Forum not found');

		const [thread] = await db.select().from(threads)
			.where(and(eq(threads.forumId, forum.id), eq(threads.slug, params.threadId)))
			.limit(1);
		if (!thread) throw error(404, 'Thread not found');

		// Check if subscription exists
		const [existing] = await db.select()
			.from(notificationSubscriptions)
			.where(and(
				eq(notificationSubscriptions.userDid, locals.user.did),
				eq(notificationSubscriptions.threadId, thread.id)
			))
			.limit(1);

		if (existing) {
			// Update subscription type to 'mute'
			await db.update(notificationSubscriptions)
				.set({ subscriptionType: 'mute' })
				.where(eq(notificationSubscriptions.id, existing.id));
		} else {
			// Insert new subscription
			await db.insert(notificationSubscriptions).values({
				userDid: locals.user.did,
				threadId: thread.id,
				subscriptionType: 'mute',
			});
		}

		throw redirect(303, `/f/${forum.slug}/t/${thread.slug}`);
	},

	unwatchThread: async ({ locals, params }) => {
		if (!locals.user) throw error(403, 'Not authenticated');

		// Resolve thread
		const [forum] = await db.select().from(forums).where(eq(forums.slug, params.forumSlug)).limit(1);
		if (!forum) throw error(404, 'Forum not found');

		const [thread] = await db.select().from(threads)
			.where(and(eq(threads.forumId, forum.id), eq(threads.slug, params.threadId)))
			.limit(1);
		if (!thread) throw error(404, 'Thread not found');

		// Delete subscription
		await db.delete(notificationSubscriptions)
			.where(and(
				eq(notificationSubscriptions.userDid, locals.user.did),
				eq(notificationSubscriptions.threadId, thread.id)
			));

		throw redirect(303, `/f/${forum.slug}/t/${thread.slug}`);
	},

	requestPiiRemoval: async ({ locals, request, params }) => {
		if (!locals.user) return fail(401, { error: 'Must be signed in' });

		const form = await request.formData();
		const postId = String(form.get('postId') ?? '').trim();
		const reason = String(form.get('reason') ?? '').trim();

		if (!postId) return fail(422, { error: 'Post ID required' });
		if (!reason) return fail(422, { error: 'Reason is required — describe the PII in this post' });

		const [post] = await db.select({ id: posts.id, status: posts.status })
			.from(posts)
			.where(eq(posts.id, postId))
			.limit(1);

		if (!post) return fail(404, { error: 'Post not found' });
		if (post.status === 'deleted') return fail(422, { error: 'Post content is already wiped' });

		// Prevent duplicate pending requests for the same post
		const existing = await db.select({ id: piiRemovalRequests.id })
			.from(piiRemovalRequests)
			.where(and(eq(piiRemovalRequests.postId, postId), eq(piiRemovalRequests.status, 'pending')))
			.limit(1);

		if (existing.length > 0) return fail(422, { error: 'A removal request for this post is already pending' });

		await db.insert(piiRemovalRequests).values({
			postId,
			requesterDid: locals.user.did,
			reason,
		});

		return { success: true, action: 'requestPiiRemoval' };
	},

	removePreview: async ({ locals, params, request }) => {
		if (!locals.user) return fail(401, { error: 'Not authenticated' });

		const form = await request.formData();
		const postId = String(form.get('postId') ?? '').trim();
		if (!postId) return fail(422, { error: 'Post ID required' });

		const [forum] = await db.select().from(forums).where(eq(forums.slug, params.forumSlug)).limit(1);
		if (!forum) throw error(404, 'Forum not found');

		const [thread] = await db.select().from(threads)
			.where(and(eq(threads.forumId, forum.id), eq(threads.slug, params.threadId)))
			.limit(1);
		if (!thread) throw error(404, 'Thread not found');

		const [post] = await db.select({ id: posts.id, authorDid: posts.authorDid })
			.from(posts)
			.where(and(eq(posts.id, postId), eq(posts.threadId, thread.id)))
			.limit(1);
		if (!post) return fail(404, { error: 'Post not found' });

		const actorIsMod = isModerator(locals.user) || await (async () => {
			const [forumRole] = await db.select().from(userForumRoles)
				.where(and(eq(userForumRoles.userDid, locals.user!.did), eq(userForumRoles.forumId, forum.id)))
				.limit(1);
			return forumRole?.role === 'moderator';
		})();

		if (post.authorDid !== locals.user.did && !actorIsMod) {
			return fail(403, { error: 'Not allowed' });
		}

		await db.update(posts).set({ linkMetadata: null }).where(eq(posts.id, postId));

		if (actorIsMod && post.authorDid !== locals.user.did) {
			await db.insert(modLog).values({
				moderatorDid: locals.user.did,
				action: 'remove_link_preview',
				targetPostId: postId,
			});
		}

		throw redirect(303, `/f/${forum.slug}/t/${thread.slug}`);
	},
};
