import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { users, modLog, sessions } from '$lib/db/schema';
import { isAdmin, isModerator } from '$lib/auth/roles.js';
import { eq, or, ilike, count } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { enqueueModerationAlert } from '$lib/notifications';
import { logger as rootLogger } from '$lib/logger';

const log = rootLogger.child({ module: 'routes:admin:users' });

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q') ?? '';
	const pageStr = url.searchParams.get('page') ?? '1';
	const pageSize = 50;
	const page = Math.max(1, parseInt(pageStr) || 1);
	const offset = (page - 1) * pageSize;

	const baseQuery = db
		.select({
			did: users.did,
			handle: users.handle,
			displayName: users.displayName,
			globalRole: users.globalRole,
			createdAt: users.createdAt
		})
		.from(users);

	const query = q.trim()
		? baseQuery.where(or(ilike(users.handle, `%${q}%`), ilike(users.displayName, `%${q}%`)))
		: baseQuery;

	const [userList, totalResult] = await Promise.all([
		query.orderBy(users.createdAt).limit(pageSize).offset(offset),
		db
			.select({ count: count() })
			.from(users)
			.where(
				q.trim()
					? or(ilike(users.handle, `%${q}%`), ilike(users.displayName, `%${q}%`))
					: undefined
			)
	]);

	const total = Number(totalResult[0]?.count || 0);
	const totalPages = Math.ceil(total / pageSize);

	return {
		users: userList,
		q,
		page,
		pageSize,
		total,
		totalPages
	};
};

export const actions: Actions = {
	ban: async ({ locals, request }) => {
		if (!locals.user || !isModerator(locals.user)) return fail(403, { error: 'Moderator access required' });
		const form = await request.formData();
		const targetDid = String(form.get('did') ?? '').trim();
		const reason = String(form.get('reason') ?? '').trim();

		if (!targetDid) return fail(422, { error: 'User DID is required' });
		if (targetDid === locals.user!.did) return fail(422, { error: 'Cannot ban yourself' });

		try {
			// Get target user's handle for notification
			const targetUser = await db.query.users.findFirst({
				where: eq(users.did, targetDid),
				columns: { handle: true }
			});

			await db.update(users).set({ globalRole: 'banned' }).where(eq(users.did, targetDid));
			// Note: Don't delete sessions. Keep them valid so validateSession() will load the updated
			// globalRole='banned' from the users table on the next request, triggering the redirect
			// in hooks.server.ts. This allows us to show the /banned page to the user.

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'ban',
				targetDid,
				reason: reason || undefined
			});

			// Enqueue moderator alert notification
			await enqueueModerationAlert(
				'ban',
				'user',
				targetDid,
				targetUser?.handle || targetDid,
				locals.user!.handle,
				reason || undefined
			);

			return { success: true, action: 'ban', targetDid };
		} catch (err) {
			log.error({ err }, 'ban action error:');
			return fail(500, { error: 'Failed to ban user' });
		}
	},

	unban: async ({ locals, request }) => {
		if (!locals.user || !isModerator(locals.user)) return fail(403, { error: 'Moderator access required' });
		const form = await request.formData();
		const targetDid = String(form.get('did') ?? '').trim();

		if (!targetDid) return fail(422, { error: 'User DID is required' });

		try {
			const targetUser = await db.query.users.findFirst({
				where: eq(users.did, targetDid),
				columns: { handle: true }
			});

			await db.update(users).set({ globalRole: 'member' }).where(eq(users.did, targetDid));

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'unban',
				targetDid
			});

			await enqueueModerationAlert(
				'unban',
				'user',
				targetDid,
				targetUser?.handle || targetDid,
				locals.user!.handle
			);

			return { success: true, action: 'unban', targetDid };
		} catch (err) {
			log.error({ err }, 'unban action error:');
			return fail(500, { error: 'Failed to unban user' });
		}
	},

	promote: async ({ locals, request }) => {
		if (!locals.user || !isAdmin(locals.user)) return fail(403, { error: 'Admin access required' });
		const form = await request.formData();
		const targetDid = String(form.get('did') ?? '').trim();

		if (!targetDid) return fail(422, { error: 'User DID is required' });

		try {
			const targetUser = await db.query.users.findFirst({
				where: eq(users.did, targetDid),
				columns: { handle: true }
			});

			await db.update(users).set({ globalRole: 'admin' }).where(eq(users.did, targetDid));
			// Invalidate all sessions so privilege change takes effect immediately
			await db.delete(sessions).where(eq(sessions.userDid, targetDid));

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'promote_admin',
				targetDid
			});

			await enqueueModerationAlert(
				'promote_admin',
				'user',
				targetDid,
				targetUser?.handle || targetDid,
				locals.user!.handle
			);

			return { success: true, action: 'promote', targetDid };
		} catch (err) {
			log.error({ err }, 'promote action error:');
			return fail(500, { error: 'Failed to promote user' });
		}
	},

	demote: async ({ locals, request }) => {
		if (!locals.user || !isAdmin(locals.user)) return fail(403, { error: 'Admin access required' });
		const form = await request.formData();
		const targetDid = String(form.get('did') ?? '').trim();

		if (!targetDid) return fail(422, { error: 'User DID is required' });
		if (targetDid === locals.user!.did) return fail(422, { error: 'Cannot demote yourself' });

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
			// Invalidate all sessions so privilege change takes effect immediately
			await db.delete(sessions).where(eq(sessions.userDid, targetDid));

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'demote_admin',
				targetDid
			});

			await enqueueModerationAlert(
				'demote_admin',
				'user',
				targetDid,
				targetUser?.handle || targetDid,
				locals.user!.handle
			);

			return { success: true, action: 'demote', targetDid };
		} catch (err) {
			log.error({ err }, 'demote action error:');
			return fail(500, { error: 'Failed to demote user' });
		}
	},

	promoteModerator: async ({ locals, request }) => {
		if (!locals.user || !isAdmin(locals.user)) return fail(403, { error: 'Admin access required' });
		const form = await request.formData();
		const targetDid = String(form.get('did') ?? '').trim();

		if (!targetDid) return fail(422, { error: 'User DID is required' });
		if (targetDid === locals.user.did) return fail(422, { error: 'Cannot change your own role' });

		try {
			const targetUser = await db.query.users.findFirst({
				where: eq(users.did, targetDid),
				columns: { handle: true, globalRole: true }
			});

			if (!targetUser) return fail(404, { error: 'User not found' });
			if (targetUser.globalRole === 'admin') return fail(422, { error: 'Cannot demote an admin to moderator via this action' });

			await db.update(users).set({ globalRole: 'moderator' }).where(eq(users.did, targetDid));
			await db.delete(sessions).where(eq(sessions.userDid, targetDid));

			await db.insert(modLog).values({
				moderatorDid: locals.user.did,
				action: 'promote_moderator',
				targetDid
			});

			return { success: true, action: 'promoteModerator', targetDid };
		} catch (err) {
			log.error({ err }, 'promoteModerator action error:');
			return fail(500, { error: 'Failed to promote user to moderator' });
		}
	},

	demoteModerator: async ({ locals, request }) => {
		if (!locals.user || !isAdmin(locals.user)) return fail(403, { error: 'Admin access required' });
		const form = await request.formData();
		const targetDid = String(form.get('did') ?? '').trim();

		if (!targetDid) return fail(422, { error: 'User DID is required' });

		try {
			const targetUser = await db.query.users.findFirst({
				where: eq(users.did, targetDid),
				columns: { handle: true, globalRole: true }
			});

			if (!targetUser) return fail(404, { error: 'User not found' });
			if (targetUser.globalRole !== 'moderator') return fail(422, { error: 'User is not a moderator' });

			await db.update(users).set({ globalRole: 'member' }).where(eq(users.did, targetDid));
			await db.delete(sessions).where(eq(sessions.userDid, targetDid));

			await db.insert(modLog).values({
				moderatorDid: locals.user.did,
				action: 'demote_moderator',
				targetDid
			});

			return { success: true, action: 'demoteModerator', targetDid };
		} catch (err) {
			log.error({ err }, 'demoteModerator action error:');
			return fail(500, { error: 'Failed to remove moderator role' });
		}
	}
};
