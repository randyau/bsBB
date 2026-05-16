import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { users, modLog } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
	const userList = await db
		.select({
			did: users.did,
			handle: users.handle,
			displayName: users.displayName,
			globalRole: users.globalRole,
			createdAt: users.createdAt
		})
		.from(users)
		.orderBy(users.createdAt);

	return {
		users: userList
	};
};

export const actions: Actions = {
	ban: async ({ locals, request }) => {
		const form = await request.formData();
		const targetDid = String(form.get('did') ?? '').trim();
		const reason = String(form.get('reason') ?? '').trim();

		if (!targetDid) return fail(422, { error: 'User DID is required' });
		if (targetDid === locals.user!.did) return fail(422, { error: 'Cannot ban yourself' });

		try {
			await db.update(users).set({ globalRole: 'banned' }).where(eq(users.did, targetDid));

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'ban',
				targetDid,
				reason: reason || undefined
			});

			return { success: true, action: 'ban', targetDid };
		} catch (err) {
			return fail(500, { error: 'Failed to ban user' });
		}
	},

	unban: async ({ locals, request }) => {
		const form = await request.formData();
		const targetDid = String(form.get('did') ?? '').trim();

		if (!targetDid) return fail(422, { error: 'User DID is required' });

		try {
			await db.update(users).set({ globalRole: 'member' }).where(eq(users.did, targetDid));

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'unban',
				targetDid
			});

			return { success: true, action: 'unban', targetDid };
		} catch (err) {
			return fail(500, { error: 'Failed to unban user' });
		}
	},

	promote: async ({ locals, request }) => {
		const form = await request.formData();
		const targetDid = String(form.get('did') ?? '').trim();

		if (!targetDid) return fail(422, { error: 'User DID is required' });

		try {
			await db.update(users).set({ globalRole: 'admin' }).where(eq(users.did, targetDid));

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'promote_admin',
				targetDid
			});

			return { success: true, action: 'promote', targetDid };
		} catch (err) {
			return fail(500, { error: 'Failed to promote user' });
		}
	},

	demote: async ({ locals, request }) => {
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
			await db.update(users).set({ globalRole: 'member' }).where(eq(users.did, targetDid));

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'demote_admin',
				targetDid
			});

			return { success: true, action: 'demote', targetDid };
		} catch (err) {
			return fail(500, { error: 'Failed to demote user' });
		}
	}
};
