import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import {
	users,
	roles,
	userRoles,
	posts,
	threads,
	forums,
	userForumRoles,
	modLog,
	sessions,
	notificationSubscriptions
} from '$lib/db/schema';
import { eq, and, desc, count } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import { enqueueModerationAlert } from '$lib/notifications';
import { emojify } from 'node-emoji';
import { logger as rootLogger } from '$lib/logger';

const log = rootLogger.child({ module: 'routes:user' });

const POSTS_PAGE_SIZE = 25;

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const postsPage = Math.max(1, Number(url.searchParams.get('postsPage') ?? 1));
	// Find user by handle
	const profileUser = await db.query.users.findFirst({
		where: eq(users.handle, params.handle)
	});

	if (!profileUser) {
		throw error(404, 'User not found');
	}

	// Load user's custom roles
	const customRoles = await db
		.select({
			id: roles.id,
			name: roles.name,
			description: roles.description,
			color: roles.color
		})
		.from(userRoles)
		.innerJoin(roles, eq(userRoles.roleId, roles.id))
		.where(eq(userRoles.userDid, profileUser.did));

	// Load paginated posts for profile
	const postsWhere = and(eq(posts.authorDid, profileUser.did), eq(posts.status, 'active'));
	const [userPosts, [{ userPostsTotal }]] = await Promise.all([
		db
			.select({
				id: posts.id,
				bodyMarkdown: posts.bodyMarkdown,
				createdAt: posts.createdAt,
				threadTitle: threads.title,
				threadSlug: threads.slug,
				forumName: forums.name,
				forumSlug: forums.slug
			})
			.from(posts)
			.innerJoin(threads, eq(posts.threadId, threads.id))
			.innerJoin(forums, eq(threads.forumId, forums.id))
			.where(postsWhere)
			.orderBy(desc(posts.createdAt))
			.limit(POSTS_PAGE_SIZE)
			.offset((postsPage - 1) * POSTS_PAGE_SIZE),
		db.select({ userPostsTotal: count() }).from(posts).where(postsWhere)
	]);

	// Load forum moderator assignments
	const forumModAssignments = await db
		.select({
			forumId: forums.id,
			forumName: forums.name,
			forumSlug: forums.slug
		})
		.from(userForumRoles)
		.innerJoin(forums, eq(userForumRoles.forumId, forums.id))
		.where(eq(userForumRoles.userDid, profileUser.did));

	// If admin, load all forums and roles for management forms
	let allForums: Array<{ id: string; name: string }> = [];
	let allRoles: Array<{ id: string; name: string; color: string | null }> = [];

	if (locals.user?.globalRole === 'admin') {
		allForums = await db.select({ id: forums.id, name: forums.name }).from(forums);
		allRoles = await db
			.select({ id: roles.id, name: roles.name, color: roles.color })
			.from(roles)
			.orderBy(roles.name);
	}

	const isAdmin = locals.user?.globalRole === 'admin';
	const isSelf = locals.user?.did === profileUser.did;

	// Load followed threads (for self-profile only)
	let followedThreads: Array<{
		threadId: string;
		threadTitle: string;
		threadSlug: string;
		forumSlug: string;
		subscriptionType: string;
	}> = [];

	if (isSelf && locals.user) {
		followedThreads = await db
			.select({
				threadId: notificationSubscriptions.threadId,
				subscriptionType: notificationSubscriptions.subscriptionType,
				threadTitle: threads.title,
				threadSlug: threads.slug,
				forumSlug: forums.slug
			})
			.from(notificationSubscriptions)
			.innerJoin(threads, eq(threads.id, notificationSubscriptions.threadId))
			.innerJoin(forums, eq(forums.id, threads.forumId))
			.where(eq(notificationSubscriptions.userDid, profileUser.did))
			.orderBy(desc(notificationSubscriptions.createdAt));
	}

	return {
		profileUser,
		customRoles,
		userPosts: userPosts.map((p) => ({
			...p,
			bodyPreview: emojify(p.bodyMarkdown.substring(0, 200))
		})),
		userPostsTotal: Number(userPostsTotal),
		userPostsPage: postsPage,
		userPostsPageSize: POSTS_PAGE_SIZE,
		forumModAssignments,
		allForums,
		allRoles,
		isAdmin,
		isSelf,
		viewerUser: locals.user ?? null,
		followedThreads
	};
};

export const actions: Actions = {
	ban: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') {
			return fail(403, { error: 'Admin access required' });
		}

		const form = await request.formData();
		const targetDid = String(form.get('targetDid') ?? '').trim();
		const reason = String(form.get('reason') ?? '').trim();

		if (!targetDid) return fail(422, { error: 'User DID is required' });
		if (targetDid === locals.user.did) return fail(422, { error: 'Cannot ban yourself' });

		try {
			const targetUser = await db.query.users.findFirst({
				where: eq(users.did, targetDid),
				columns: { handle: true }
			});

			await db.update(users).set({ globalRole: 'banned' }).where(eq(users.did, targetDid));
			await db.delete(sessions).where(eq(sessions.userDid, targetDid));

			await db.insert(modLog).values({
				moderatorDid: locals.user.did,
				action: 'ban',
				targetDid,
				reason: reason || undefined
			});

			await enqueueModerationAlert(
				'ban',
				'user',
				targetDid,
				targetUser?.handle || targetDid,
				locals.user.handle,
				reason || undefined
			);

			return { success: true, action: 'ban', targetDid };
		} catch (err) {
			log.error({ err }, 'ban action error:');
			return fail(500, { error: 'Failed to ban user' });
		}
	},

	unban: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') {
			return fail(403, { error: 'Admin access required' });
		}

		const form = await request.formData();
		const targetDid = String(form.get('targetDid') ?? '').trim();

		if (!targetDid) return fail(422, { error: 'User DID is required' });

		try {
			const targetUser = await db.query.users.findFirst({
				where: eq(users.did, targetDid),
				columns: { handle: true }
			});

			await db.update(users).set({ globalRole: 'member' }).where(eq(users.did, targetDid));

			await db.insert(modLog).values({
				moderatorDid: locals.user.did,
				action: 'unban',
				targetDid
			});

			await enqueueModerationAlert(
				'unban',
				'user',
				targetDid,
				targetUser?.handle || targetDid,
				locals.user.handle
			);

			return { success: true, action: 'unban', targetDid };
		} catch (err) {
			log.error({ err }, 'unban action error:');
			return fail(500, { error: 'Failed to unban user' });
		}
	},

	promote: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') {
			return fail(403, { error: 'Admin access required' });
		}

		const form = await request.formData();
		const targetDid = String(form.get('targetDid') ?? '').trim();

		if (!targetDid) return fail(422, { error: 'User DID is required' });

		try {
			const targetUser = await db.query.users.findFirst({
				where: eq(users.did, targetDid),
				columns: { handle: true }
			});

			await db.update(users).set({ globalRole: 'admin' }).where(eq(users.did, targetDid));

			await db.insert(modLog).values({
				moderatorDid: locals.user.did,
				action: 'promote_admin',
				targetDid
			});

			await enqueueModerationAlert(
				'promote_admin',
				'user',
				targetDid,
				targetUser?.handle || targetDid,
				locals.user.handle
			);

			return { success: true, action: 'promote', targetDid };
		} catch (err) {
			log.error({ err }, 'promote action error:');
			return fail(500, { error: 'Failed to promote user' });
		}
	},

	demote: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') {
			return fail(403, { error: 'Admin access required' });
		}

		const form = await request.formData();
		const targetDid = String(form.get('targetDid') ?? '').trim();

		if (!targetDid) return fail(422, { error: 'User DID is required' });
		if (targetDid === locals.user.did) return fail(422, { error: 'Cannot demote yourself' });

		// Check if this is the last admin
		const adminCount = (
			await db
				.select({ count: users.did })
				.from(users)
				.where(eq(users.globalRole, 'admin'))
		).length;

		if (adminCount === 1) {
			return fail(422, { error: 'Cannot demote the last admin' });
		}

		try {
			const targetUser = await db.query.users.findFirst({
				where: eq(users.did, targetDid),
				columns: { handle: true }
			});

			await db.update(users).set({ globalRole: 'member' }).where(eq(users.did, targetDid));

			await db.insert(modLog).values({
				moderatorDid: locals.user.did,
				action: 'demote_admin',
				targetDid
			});

			await enqueueModerationAlert(
				'demote_admin',
				'user',
				targetDid,
				targetUser?.handle || targetDid,
				locals.user.handle
			);

			return { success: true, action: 'demote', targetDid };
		} catch (err) {
			log.error({ err }, 'demote action error:');
			return fail(500, { error: 'Failed to demote user' });
		}
	},

	assignForumMod: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') {
			return fail(403, { error: 'Admin access required' });
		}

		const form = await request.formData();
		const targetDid = String(form.get('targetDid') ?? '').trim();
		const forumId = String(form.get('forumId') ?? '').trim();

		if (!targetDid || !forumId) {
			return fail(422, { error: 'User and forum are required' });
		}

		try {
			// Check if already assigned
			const existing = await db.query.userForumRoles.findFirst({
				where: and(
					eq(userForumRoles.userDid, targetDid),
					eq(userForumRoles.forumId, forumId)
				)
			});

			if (!existing) {
				await db.insert(userForumRoles).values({
					userDid: targetDid,
					forumId,
					role: 'moderator',
					assignedBy: locals.user.did
				});

				await db.insert(modLog).values({
					moderatorDid: locals.user.did,
					action: 'assign_forum_mod',
					targetDid,
					targetForumId: forumId
				});
			}

			return { success: true, action: 'assignForumMod', targetDid, forumId };
		} catch (err) {
			log.error({ err }, 'assignForumMod action error:');
			return fail(500, { error: 'Failed to assign forum moderator' });
		}
	},

	removeForumMod: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') {
			return fail(403, { error: 'Admin access required' });
		}

		const form = await request.formData();
		const targetDid = String(form.get('targetDid') ?? '').trim();
		const forumId = String(form.get('forumId') ?? '').trim();

		if (!targetDid || !forumId) {
			return fail(422, { error: 'User and forum are required' });
		}

		try {
			await db
				.delete(userForumRoles)
				.where(
					and(
						eq(userForumRoles.userDid, targetDid),
						eq(userForumRoles.forumId, forumId)
					)
				);

			await db.insert(modLog).values({
				moderatorDid: locals.user.did,
				action: 'remove_forum_mod',
				targetDid,
				targetForumId: forumId
			});

			return { success: true, action: 'removeForumMod', targetDid, forumId };
		} catch (err) {
			log.error({ err }, 'removeForumMod action error:');
			return fail(500, { error: 'Failed to remove forum moderator' });
		}
	},

	assignCustomRole: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') {
			return fail(403, { error: 'Admin access required' });
		}

		const form = await request.formData();
		const targetDid = String(form.get('targetDid') ?? '').trim();
		const roleId = String(form.get('roleId') ?? '').trim();

		if (!targetDid || !roleId) {
			return fail(422, { error: 'User and role are required' });
		}

		try {
			// Get role name for logging
			const role = await db.query.roles.findFirst({
				where: eq(roles.id, roleId)
			});

			// Insert with onConflictDoNothing if already assigned
			await db
				.insert(userRoles)
				.values({
					userDid: targetDid,
					roleId,
					assignedBy: locals.user.did
				})
				.onConflictDoNothing();

			await db.insert(modLog).values({
				moderatorDid: locals.user.did,
				action: 'assign_custom_role',
				targetDid,
				reason: role?.name || roleId
			});

			return { success: true, action: 'assignCustomRole', targetDid, roleId };
		} catch (err) {
			log.error({ err }, 'assignCustomRole action error:');
			return fail(500, { error: 'Failed to assign custom role' });
		}
	},

	removeCustomRole: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') {
			return fail(403, { error: 'Admin access required' });
		}

		const form = await request.formData();
		const targetDid = String(form.get('targetDid') ?? '').trim();
		const roleId = String(form.get('roleId') ?? '').trim();

		if (!targetDid || !roleId) {
			return fail(422, { error: 'User and role are required' });
		}

		try {
			// Get role name for logging
			const role = await db.query.roles.findFirst({
				where: eq(roles.id, roleId)
			});

			await db
				.delete(userRoles)
				.where(
					and(
						eq(userRoles.userDid, targetDid),
						eq(userRoles.roleId, roleId)
					)
				);

			await db.insert(modLog).values({
				moderatorDid: locals.user.did,
				action: 'remove_custom_role',
				targetDid,
				reason: role?.name || roleId
			});

			return { success: true, action: 'removeCustomRole', targetDid, roleId };
		} catch (err) {
			log.error({ err }, 'removeCustomRole action error:');
			return fail(500, { error: 'Failed to remove custom role' });
		}
	}
};
