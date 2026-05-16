import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { roles, userRoles, modLog } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { count } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || locals.user.globalRole !== 'admin') {
		return { roles: [] };
	}

	const roleList = await db
		.select({
			id: roles.id,
			name: roles.name,
			description: roles.description,
			color: roles.color,
			createdAt: roles.createdAt,
			memberCount: count(userRoles.userDid)
		})
		.from(roles)
		.leftJoin(userRoles, eq(roles.id, userRoles.roleId))
		.groupBy(roles.id)
		.orderBy(roles.name);

	return {
		roles: roleList
	};
};

export const actions: Actions = {
	createRole: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') {
			return fail(403, { error: 'Admin access required' });
		}

		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const description = String(form.get('description') ?? '').trim() || null;
		const color = String(form.get('color') ?? '').trim() || null;

		if (!name || name.length === 0) {
			return fail(422, { error: 'Role name is required' });
		}

		if (name.length > 50) {
			return fail(422, { error: 'Role name must be 50 characters or less' });
		}

		// Validate hex color if provided
		if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
			return fail(422, { error: 'Color must be a valid hex color (e.g. #e11d48)' });
		}

		try {
			const newRole = await db
				.insert(roles)
				.values({
					name,
					description: description || undefined,
					color: color || undefined
				})
				.returning();

			await db.insert(modLog).values({
				moderatorDid: locals.user.did,
				action: 'create_role',
				reason: name
			});

			return { success: true, role: newRole[0] };
		} catch (err) {
			console.error('createRole action error:', err);
			if (err instanceof Error && err.message.includes('duplicate key')) {
				return fail(422, { error: 'A role with this name already exists' });
			}
			return fail(500, { error: 'Failed to create role' });
		}
	},

	editRole: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') {
			return fail(403, { error: 'Admin access required' });
		}

		const form = await request.formData();
		const id = String(form.get('id') ?? '').trim();
		const name = String(form.get('name') ?? '').trim();
		const description = String(form.get('description') ?? '').trim() || null;
		const color = String(form.get('color') ?? '').trim() || null;

		if (!id || !name || name.length === 0) {
			return fail(422, { error: 'Role ID and name are required' });
		}

		if (name.length > 50) {
			return fail(422, { error: 'Role name must be 50 characters or less' });
		}

		// Validate hex color if provided
		if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
			return fail(422, { error: 'Color must be a valid hex color (e.g. #e11d48)' });
		}

		try {
			const updated = await db
				.update(roles)
				.set({
					name,
					description: description || undefined,
					color: color || undefined
				})
				.where(eq(roles.id, id))
				.returning();

			if (updated.length === 0) {
				return fail(404, { error: 'Role not found' });
			}

			await db.insert(modLog).values({
				moderatorDid: locals.user.did,
				action: 'edit_role',
				reason: name
			});

			return { success: true, role: updated[0] };
		} catch (err) {
			console.error('editRole action error:', err);
			if (err instanceof Error && err.message.includes('duplicate key')) {
				return fail(422, { error: 'A role with this name already exists' });
			}
			return fail(500, { error: 'Failed to update role' });
		}
	},

	deleteRole: async ({ locals, request }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') {
			return fail(403, { error: 'Admin access required' });
		}

		const form = await request.formData();
		const id = String(form.get('id') ?? '').trim();

		if (!id) {
			return fail(422, { error: 'Role ID is required' });
		}

		try {
			// Delete the role (userRoles cascade-deletes via FK)
			const deleted = await db.delete(roles).where(eq(roles.id, id)).returning();

			if (deleted.length === 0) {
				return fail(404, { error: 'Role not found' });
			}

			await db.insert(modLog).values({
				moderatorDid: locals.user.did,
				action: 'delete_role',
				reason: deleted[0].name
			});

			return { success: true, roleId: id };
		} catch (err) {
			console.error('deleteRole action error:', err);
			return fail(500, { error: 'Failed to delete role' });
		}
	}
};
