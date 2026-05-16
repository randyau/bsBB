import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { users, modLog, sessions } from '$lib/db/schema';
import { eq, or, ilike } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { enqueueModerationAlert } from '$lib/notifications';

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q') ?? '';

	const baseQuery = db
		.select({
			did: users.did,
			handle: users.handle,
			displayName: users.displayName,
			globalRole: users.globalRole,
			createdAt: users.createdAt
		})
		.from(users);

	const userList = await (q.trim()
		? baseQuery.where(or(ilike(users.handle, `%${q}%`), ilike(users.displayName, `%${q}%`)))
		: baseQuery
	).orderBy(users.createdAt);

	return {
		users: userList,
		q
	};
};

export const actions: Actions = {
	ban: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
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
			// Immediately invalidate all active sessions so the ban takes effect now
			await db.delete(sessions).where(eq(sessions.userDid, targetDid));

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
			console.error('ban action error:', err);
			return fail(500, { error: 'Failed to ban user' });
		}
	},

	unban: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
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
			console.error('unban action error:', err);
			return fail(500, { error: 'Failed to unban user' });
		}
	},

	promote: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
		const form = await request.formData();
		const targetDid = String(form.get('did') ?? '').trim();

		if (!targetDid) return fail(422, { error: 'User DID is required' });

		try {
			const targetUser = await db.query.users.findFirst({
				where: eq(users.did, targetDid),
				columns: { handle: true }
			});

			await db.update(users).set({ globalRole: 'admin' }).where(eq(users.did, targetDid));

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
			console.error('promote action error:', err);
			return fail(500, { error: 'Failed to promote user' });
		}
	},

	demote: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
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
			console.error('demote action error:', err);
			return fail(500, { error: 'Failed to demote user' });
		}
	}
};
