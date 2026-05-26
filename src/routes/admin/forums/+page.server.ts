import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { forums, userForumRoles, modLog, users, roles, forumPermissions } from '$lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import { logger as rootLogger } from '$lib/logger';

const log = rootLogger.child({ module: 'routes:admin:forums' });

export const load: PageServerLoad = async () => {
	const forumList = await db
		.select({
			id: forums.id,
			name: forums.name,
			description: forums.description,
			slug: forums.slug,
			parentId: forums.parentId,
			sortOrder: forums.sortOrder,
			requireApprovalDays: forums.requireApprovalDays,
		})
		.from(forums)
		.orderBy(forums.sortOrder);

	const userList = await db
		.select({
			did: users.did,
			handle: users.handle,
			displayName: users.displayName
		})
		.from(users)
		.orderBy(users.handle);

	const modsData = await db
		.select({
			userDid: userForumRoles.userDid,
			forumId: userForumRoles.forumId,
			userHandle: users.handle,
			userDisplayName: users.displayName,
			forumName: forums.name
		})
		.from(userForumRoles)
		.innerJoin(users, eq(userForumRoles.userDid, users.did))
		.innerJoin(forums, eq(userForumRoles.forumId, forums.id))
		.where(eq(userForumRoles.role, 'moderator'));

	// Get parent forum names for display
	const parentNames: Record<string, string> = {};
	for (const forum of forumList) {
		if (forum.parentId) {
			const parent = forumList.find(f => f.id === forum.parentId);
			if (parent) {
				parentNames[forum.id] = parent.name;
			}
		}
	}

	// Fetch all custom roles
	const roleList = await db
		.select({
			id: roles.id,
			name: roles.name
		})
		.from(roles)
		.orderBy(roles.name);

	// Fetch all forum permissions
	const permissionsList = await db
		.select({
			id: forumPermissions.id,
			forumId: forumPermissions.forumId,
			role: forumPermissions.role,
			canRead: forumPermissions.canRead,
			canPost: forumPermissions.canPost,
			canModerate: forumPermissions.canModerate
		})
		.from(forumPermissions);

	// Group permissions by forum
	const permissionsByForum: Record<string, typeof permissionsList> = {};
	for (const perm of permissionsList) {
		if (!permissionsByForum[perm.forumId]) {
			permissionsByForum[perm.forumId] = [];
		}
		permissionsByForum[perm.forumId].push(perm);
	}

	return {
		forums: forumList.map((f) => ({
			...f,
			parentName: parentNames[f.id] || null,
		})),
		users: userList,
		mods: modsData,
		roles: roleList,
		permissions: permissionsByForum
	};
};

export const actions: Actions = {
	reorder: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
		const form = await request.formData();
		const forumId = String(form.get('forumId') ?? '').trim();
		const direction = String(form.get('direction') ?? '').trim();

		if (!forumId || !['up', 'down'].includes(direction)) {
			return fail(422, { error: 'Invalid request' });
		}

		try {
			const forum = await db.query.forums.findFirst({
				where: eq(forums.id, forumId),
				columns: { sortOrder: true }
			});

			if (!forum) return fail(404, { error: 'Forum not found' });

			const newOrder = direction === 'up' ? Math.max(0, forum.sortOrder - 1) : forum.sortOrder + 1;

			// Swap with adjacent forum
			const adjacent = await db.query.forums.findFirst({
				where: eq(forums.sortOrder, newOrder),
				columns: { id: true }
			});

			if (adjacent) {
				await db.update(forums).set({ sortOrder: forum.sortOrder }).where(eq(forums.id, adjacent.id));
			}

			await db.update(forums).set({ sortOrder: newOrder }).where(eq(forums.id, forumId));

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'reorder_forum',
				targetForumId: forumId,
				reason: `Moved ${direction}`
			});

			return { success: true, action: 'reorder' };
		} catch (err) {
			log.error({ err }, 'reorder action error:');
			return fail(500, { error: 'Failed to reorder forum' });
		}
	},

	assignMod: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
		const form = await request.formData();
		const forumId = String(form.get('forumId') ?? '').trim();
		const userDid = String(form.get('userDid') ?? '').trim();

		if (!forumId || !userDid) return fail(422, { error: 'Forum and user DID are required' });

		try {
			// Check if already a mod
			const existing = await db.query.userForumRoles.findFirst({
				where: (ufr) => eq(ufr.forumId, forumId) && eq(ufr.userDid, userDid)
			});

			if (existing) {
				return fail(422, { error: 'User is already a moderator for this forum' });
			}

			await db.insert(userForumRoles).values({
				userDid,
				forumId,
				role: 'moderator',
				assignedBy: locals.user!.did
			});

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'assign_forum_mod',
				targetDid: userDid,
				targetForumId: forumId
			});

			return { success: true, action: 'assignMod' };
		} catch (err) {
			log.error({ err }, 'assignMod action error:');
			return fail(500, { error: 'Failed to assign moderator' });
		}
	},

	removeMod: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
		const form = await request.formData();
		const forumId = String(form.get('forumId') ?? '').trim();
		const userDid = String(form.get('userDid') ?? '').trim();

		if (!forumId || !userDid) return fail(422, { error: 'Forum and user DID are required' });

		try {
			await db.delete(userForumRoles).where(
				and(eq(userForumRoles.forumId, forumId), eq(userForumRoles.userDid, userDid))
			);

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'remove_forum_mod',
				targetDid: userDid,
				targetForumId: forumId
			});

			return { success: true, action: 'removeMod' };
		} catch (err) {
			log.error({ err }, 'removeMod action error:');
			return fail(500, { error: 'Failed to remove moderator' });
		}
	},

	setApprovalDays: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
		const form = await request.formData();
		const forumId = String(form.get('forumId') ?? '').trim();
		const days = parseInt(String(form.get('days') ?? '0'), 10);

		if (!forumId || isNaN(days) || days < 0) return fail(422, { error: 'Invalid request' });

		try {
			await db.update(forums).set({ requireApprovalDays: days }).where(eq(forums.id, forumId));

			await db.insert(modLog).values({
				moderatorDid: locals.user.did,
				action: 'set_approval_days',
				targetForumId: forumId,
				reason: days === 0 ? 'Disabled approval requirement' : `Require approval for accounts < ${days} days old`,
			});

			return { success: true, action: 'setApprovalDays' };
		} catch (err) {
			log.error({ err }, 'setApprovalDays action error:');
			return fail(500, { error: 'Failed to update approval setting' });
		}
	},

	updatePermission: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
		const form = await request.formData();
		const forumId = String(form.get('forumId') ?? '').trim();
		const role = String(form.get('role') ?? '').trim();
		const permType = String(form.get('permType') ?? '').trim(); // canRead, canPost, canModerate
		const value = form.get('value') === 'true';

		if (!forumId || !role || !['canRead', 'canPost', 'canModerate'].includes(permType)) {
			return fail(422, { error: 'Invalid request' });
		}

		if (['admin', 'moderator'].includes(role)) {
			return fail(422, { error: 'System roles cannot have per-forum permissions configured' });
		}

		try {
			// Check if permission row exists
			const existing = await db.query.forumPermissions.findFirst({
				where: and(eq(forumPermissions.forumId, forumId), eq(forumPermissions.role, role))
			});

			if (existing) {
				// Update existing permission
				if (permType === 'canRead') {
					await db
						.update(forumPermissions)
						.set({ canRead: value })
						.where(and(eq(forumPermissions.forumId, forumId), eq(forumPermissions.role, role)));
				} else if (permType === 'canPost') {
					await db
						.update(forumPermissions)
						.set({ canPost: value })
						.where(and(eq(forumPermissions.forumId, forumId), eq(forumPermissions.role, role)));
				} else if (permType === 'canModerate') {
					await db
						.update(forumPermissions)
						.set({ canModerate: value })
						.where(and(eq(forumPermissions.forumId, forumId), eq(forumPermissions.role, role)));
				}
			} else {
				// Create new permission row
				const newPerm = {
					forumId,
					role,
					canRead: permType === 'canRead' ? value : false,
					canPost: permType === 'canPost' ? value : false,
					canModerate: permType === 'canModerate' ? value : false
				};

				await db.insert(forumPermissions).values(newPerm);
			}

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'update_forum_permission',
				targetForumId: forumId,
				reason: `${role}: ${permType}=${value}`
			});

			return { success: true, action: 'updatePermission' };
		} catch (err) {
			log.error({ err }, 'updatePermission action error:');
			return fail(500, { error: 'Failed to update permission' });
		}
	},

	createForum: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const description = String(form.get('description') ?? '').trim();
		const parentId = String(form.get('parentId') ?? '').trim() || null;

		if (!name || name.length < 2) {
			return fail(422, { error: 'Forum name must be at least 2 characters' });
		}

		try {
			const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

			const maxOrder = await db
				.select({ max: sql<number>`MAX(${forums.sortOrder})` })
				.from(forums);

			const sortOrder = (maxOrder[0]?.max ?? -1) + 1;
			const id = randomUUID();

			await db.insert(forums).values({
				id,
				name,
				description,
				slug,
				parentId,
				sortOrder
			});

			// Set default permissions for guest and member roles
			const defaultRoles = ['guest', 'member'];
			for (const role of defaultRoles) {
				await db.insert(forumPermissions).values({
					forumId: id,
					role,
					canRead: true,
					canPost: role === 'member',
					canModerate: false
				});
			}

			await db.insert(modLog).values({
				moderatorDid: locals.user!.did,
				action: 'create_forum',
				targetForumId: id,
				reason: `Created forum: ${name}`
			});

			return { success: true, action: 'createForum', forumId: id };
		} catch (err) {
			log.error({ err }, 'createForum action error:');
			return fail(500, { error: 'Failed to create forum' });
		}
	},

	editForum: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
		const form = await request.formData();
		const forumId = String(form.get('forumId') ?? '').trim();
		const name = String(form.get('name') ?? '').trim();
		const description = String(form.get('description') ?? '').trim();
		const parentId = String(form.get('parentId') ?? '').trim() || null;

		if (!forumId || !name || name.length < 2) {
			return fail(422, { error: 'Forum name must be at least 2 characters' });
		}

		try {
			// Check forum exists
			const forum = await db.query.forums.findFirst({
				where: eq(forums.id, forumId),
				columns: { id: true, parentId: true }
			});

			if (!forum) return fail(404, { error: 'Forum not found' });

			// Prevent self-referential parent
			if (parentId === forumId) {
				return fail(422, { error: 'A forum cannot be its own parent' });
			}

			// Validate parent exists if specified
			if (parentId) {
				const parent = await db.query.forums.findFirst({
					where: eq(forums.id, parentId),
					columns: { id: true }
				});
				if (!parent) return fail(422, { error: 'Parent forum not found' });
			}

			await db.update(forums)
				.set({ name, description, parentId })
				.where(eq(forums.id, forumId));

			await db.insert(modLog).values({
				moderatorDid: locals.user.did,
				action: 'edit_forum',
				targetForumId: forumId,
				reason: `Edited: name="${name}", parent=${parentId ? `"${parentId}"` : 'none'}`
			});

			return { success: true, action: 'editForum' };
		} catch (err) {
			log.error({ err }, 'editForum action error:');
			return fail(500, { error: 'Failed to edit forum' });
		}
	}
};
