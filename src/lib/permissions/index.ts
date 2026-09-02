import { eq, and, inArray } from 'drizzle-orm';
import { forums, forumPermissions, userForumRoles, userRoles, roles, instanceSettings } from '$lib/db/schema';
import type { SessionUser } from '$lib/auth/session';
import type { db as dbType } from '$lib/db';
import { isModerator } from '$lib/auth/roles.js';
import { sql } from 'drizzle-orm';

/**
 * Returns the ordered chain of forum IDs from forumId up to the root in a single query.
 * Replaces the old loop-per-level approach (N+1) with a single recursive CTE.
 */
export async function getParentChain(db: typeof dbType, forumId: string): Promise<string[]> {
	const rows = await db.execute(sql`
		WITH RECURSIVE chain AS (
			SELECT id, parent_id FROM forums WHERE id = ${forumId}
			UNION ALL
			SELECT f.id, f.parent_id FROM forums f JOIN chain c ON f.id = c.parent_id
		)
		SELECT id FROM chain
	`);
	return (rows as unknown as Array<{ id: string }>).map(r => r.id);
}

/**
 * Check if a user can read a specific forum.
 * Admin always true, banned always false, others: check explicit roles + instance default.
 */
export async function canRead(
	db: typeof dbType,
	forumId: string,
	user: SessionUser | null
): Promise<boolean> {
	if (isModerator(user)) return true;
	if (user?.globalRole === 'banned') return false;

	let effectiveRole = 'guest';
	if (user) {
		const userRole = await db.query.userForumRoles.findFirst({
			where: and(eq(userForumRoles.userDid, user.did), eq(userForumRoles.forumId, forumId)),
		});
		effectiveRole = userRole?.role ?? user.globalRole ?? 'guest';
	}

	const chain = await getParentChain(db, forumId);

	// Fetch all permission rows for this role across the whole chain in one query
	const perms = await db
		.select()
		.from(forumPermissions)
		.where(and(inArray(forumPermissions.forumId, chain), eq(forumPermissions.role, effectiveRole)));

	const permMap = new Map(perms.map(p => [p.forumId, p]));

	for (const chainForumId of chain) {
		const perm = permMap.get(chainForumId);
		if (perm) return perm.canRead; // explicit allow or deny — stop traversal
	}

	// No explicit permission — check custom roles
	if (user) {
		const hasCustom = await hasCustomRolePermission(db, chain, user.did, 'canRead');
		if (hasCustom) return true;
	}

	// Fall back to instance default
	const defaultVisibility = await db.query.instanceSettings.findFirst({
		where: eq(instanceSettings.key, 'default_forum_visibility'),
	});
	const visibility = defaultVisibility?.value || 'public';
	if (visibility === 'public') return true;
	return effectiveRole !== 'guest';
}

/**
 * Check if a user can post in a specific forum.
 */
export async function canPost(
	db: typeof dbType,
	forumId: string,
	user: SessionUser | null
): Promise<boolean> {
	if (isModerator(user)) return true;
	if (user?.globalRole === 'banned') return false;
	if (!user) return false;

	let effectiveRole: string = user.globalRole ?? 'guest';
	const userRole = await db.query.userForumRoles.findFirst({
		where: and(eq(userForumRoles.userDid, user.did), eq(userForumRoles.forumId, forumId)),
	});
	if (userRole) effectiveRole = userRole.role;

	const chain = await getParentChain(db, forumId);

	const perms = await db
		.select()
		.from(forumPermissions)
		.where(and(inArray(forumPermissions.forumId, chain), eq(forumPermissions.role, effectiveRole)));

	const permMap = new Map(perms.map(p => [p.forumId, p]));

	for (const chainForumId of chain) {
		const perm = permMap.get(chainForumId);
		if (perm) return perm.canPost;
	}

	const hasCustom = await hasCustomRolePermission(db, chain, user.did, 'canPost');
	if (hasCustom) return true;

	return true; // members can post by default
}

/**
 * Check if a user holds an explicit per-forum "moderator" assignment for this forum,
 * honoring hierarchical inheritance: a moderator assigned at a parent forum has mod
 * rights in child forums unless a closer row in the chain assigns a different role.
 * Does not consider global admin/moderator role — callers should check isModerator() first.
 */
export async function isForumModerator(
	db: typeof dbType,
	userDid: string,
	forumId: string
): Promise<boolean> {
	const chain = await getParentChain(db, forumId);
	if (chain.length === 0) return false;

	const rows = await db
		.select()
		.from(userForumRoles)
		.where(and(eq(userForumRoles.userDid, userDid), inArray(userForumRoles.forumId, chain)));

	const roleMap = new Map(rows.map(r => [r.forumId, r.role]));

	for (const chainForumId of chain) {
		const role = roleMap.get(chainForumId);
		if (role) return role === 'moderator';
	}

	return false;
}

/**
 * Check if a user has any custom roles that grant a specific permission for a forum.
 * Accepts a pre-fetched chain to avoid redundant CTE calls.
 */
async function hasCustomRolePermission(
	db: typeof dbType,
	chain: string[],
	userDid: string,
	field: 'canRead' | 'canPost'
): Promise<boolean> {
	const assigned = await db
		.select({ roleName: roles.name })
		.from(userRoles)
		.innerJoin(roles, eq(userRoles.roleId, roles.id))
		.where(eq(userRoles.userDid, userDid));

	if (assigned.length === 0) return false;

	const roleNames = assigned.map(r => r.roleName);

	// Fetch all matching permission rows for the chain + role names in one query
	const perms = await db
		.select()
		.from(forumPermissions)
		.where(and(inArray(forumPermissions.forumId, chain), inArray(forumPermissions.role, roleNames)));

	const permMap = new Map(perms.map(p => [`${p.forumId}:${p.role}`, p]));

	for (const chainForumId of chain) {
		for (const roleName of roleNames) {
			const perm = permMap.get(`${chainForumId}:${roleName}`);
			if (perm && perm[field]) return true;
		}
	}

	return false;
}
